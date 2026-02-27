import { createWorker, Worker, LoggerMessage } from 'tesseract.js'
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
import chi_simPath from '@tesseract.js-data/chi_sim/4.0.0/chi_sim.traineddata.gz?url';

const cacheIDB = async (path: string, data: Uint8Array): Promise<void> => {
  const openRequest = indexedDB.open('keyval-store');
  const db: IDBDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onupgradeneeded = (_event: Event) => {
      const db = event.target!.result as IDBDatabase;
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    };
  });
  const transaction = db.transaction(['keyval'], 'readwrite');
  const store = transaction.objectStore('keyval');
  const putRequest = store.put(data, path);
  await new Promise<IDBValidKey>((resolve, reject) => {
    putRequest.onerror = () => reject(putRequest.error);
    putRequest.onsuccess = ()=> resolve(putRequest.result);
  });
}

import {
  OCR_QUERY,
  OCR_RESULT,
  SCREENSHOT_REQUEST,
} from '@/utils/messages'

const consumeStream = async (stream: ReadableStream): Promise<Uint8Array<ArrayBufferLike>> => {
  const reader = stream.getReader();
  let totalLength = 0;
  const encodedChunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    encodedChunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of encodedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

const cropImageDataUrl = async (
  dataUrl: string,
  rect: {
    width: number, height: number,
    left: number, top: number
  }
): Promise<{ croppedImageDataUrl: string, croppedImageCanvas: OffscreenCanvas }> => {
  const { width, top, left, height } = rect;
  const croppedImageCanvas = new OffscreenCanvas(width, height);
  const ctx = croppedImageCanvas.getContext('2d')!;

  const response: Response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Got non-ok response from screenshotUrl fetch ${response}`);
  }
  const screenshotBitmap = await response.blob().then(createImageBitmap)
  ctx.drawImage(screenshotBitmap, left, top, width, height, 0, 0, width, height);

  const croppedImageDataUrl = await croppedImageCanvas.convertToBlob()
  .then((blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result!.toString());
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }));
  return {
    croppedImageDataUrl,
    croppedImageCanvas,
  };
}

type Logger = (arg: LoggerMessage) => void;
type ErrorHandler = (arg: any) => void;

let worker: Worker | null = null;
let creatingWorker: Promise<void> | null = null;
export const initWorker = async (
  logger: Logger,
  errorHandler: ErrorHandler,
): Promise<void> => {
  if (worker) return;
  if (creatingWorker) {
    await creatingWorker;
  } else if (!worker) {
    creatingWorker = new Promise(async () => {
      // Load no languages.
      worker = await createWorker([], 1, {
        workerPath,
        corePath,
        logger,
        errorHandler,
        workerBlobURL: false,
      });

      // Bundler automatically unzips when loading.
      const chi_simRes = await fetch(chi_simPath);
      const chi_simData = await chi_simRes.bytes();

      /* Unzip manually if loading as public asset.
      const chi_simRes = await fetch('chi_sim.traineddata.gz');
      if (!chi_simRes.ok) {
        reject('Failed to fetch chi_sim trained data.');
        return;
      }
      const chi_simData = await consumeStream(
        chi_simRes.body!
          .pipeThrough(new DecompressionStream('gzip'))
      );
      */

      // Manually cache traineddata for worker.
      await cacheIDB('./chi_sim.traineddata', chi_simData);
    });
    await creatingWorker;
    creatingWorker = null;
  }
};

export const handleOcrRequest = async (
  message: OCR_QUERY,
  logger: Logger,
  errorHandler: ErrorHandler,
): Promise<OCR_RESULT> => {
  const {
    width: width_ , height: height_,
    left: left_, top: top_ ,
    pixelRatio,
    windowId
  } = message.payload;
  const [width, height, left, top] = [width_, height_, left_, top_].map(v => v * pixelRatio);
  const screenshotRequest: SCREENSHOT_REQUEST = {
    type: 'SCREENSHOT_REQUEST',
    payload: { windowId },
  };
  return await browser.runtime.sendMessage(screenshotRequest)
  .then(async (screenshotUrl) => {
    const {
      croppedImageDataUrl,
      croppedImageCanvas,
    } = await cropImageDataUrl(
      screenshotUrl,
      { width, height, left, top },
    );

    let recognizedText: string = '';
    initWorker(logger, errorHandler);
    if (worker) {
      const { data: { text }} = await worker.recognize(croppedImageCanvas);
      recognizedText = text.replaceAll(' ', '');
    } else {
      throw Error('Worker not constructed');
    }

    const ocrResult: OCR_RESULT = {
      type: 'OCR_RESULT',
      payload: { imageUrl: croppedImageDataUrl, text: recognizedText },
    }
    return ocrResult;
  });
}
