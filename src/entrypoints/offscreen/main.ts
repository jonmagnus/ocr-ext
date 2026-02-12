import { createWorker, Worker, LoggerMessage } from 'tesseract.js'
import { instanceOfOcrQuery, SCREENSHOT_REQUEST, OCR_RESULT } from '@/utils/messages'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
/*
import corePath from 'tesseract.js-core/?url'
import langPath from '@tesseract.js-data/chi_sim?url'
*/
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
//import langPath from '@tesseract.js-data/chi_sim/4.0.0/chi_sim.traineddata.gz?url'
//import langPath from '@tesseract.js-data/chi_sim?url'

document.querySelector('#app')!.innerHTML = `
  <div>
    <h1>Worker log</h1>
    <div id="log"></div>
  </div>
`;

const logDiv = document.querySelector('#log')!;
let progressBars = new Map<string, HTMLProgressElement>();

const logDivLogger = (m: LoggerMessage) => {
  if (m.progress !== undefined) {
    let bar = progressBars.get(m.status);
    if (bar) {
      bar.value = m.progress;
    } else {
      const progressDiv = document.createElement('div');
      const labelElement = document.createElement('label');
      labelElement.innerHTML = `<p>${m.status}</p>`;
      bar = document.createElement('progress');
      bar.value = m.progress;
      bar.max = 1;
      labelElement.appendChild(bar);
      progressDiv.appendChild(labelElement);
      logDiv.appendChild(progressDiv);
      progressBars.set(m.status, bar);
    }
  }
}

const logDivErrorHandler = (e: Error) => {
  const errorP = document.createElement('p');
  errorP.innerHTML = JSON.stringify(e, null, 2);
  errorP.style.backgroundColor = 'red';
  const pDiv = document.createElement('div');
  pDiv.appendChild(errorP);
  logDiv.append(pDiv);
}

let worker: Worker | null = null;
let creatingWorker: Promise<void> | null = null;
const initWorker = async () => {
  if (worker) return;
  if (creatingWorker) {
    await creatingWorker;
  } else if (!worker) {
    creatingWorker = createWorker('chi_sim', 1, {
      workerPath,
      corePath,
      //langPath,
      logger: logDivLogger,
      errorHandler: logDivErrorHandler,
      workerBlobURL: false,
    })
    .then(w => { worker = w; }, e => {throw new Error(e)});
    await creatingWorker;
    creatingWorker = null;
  }
};
initWorker();

browser.runtime.onMessage.addListener((message, _sender, sendResponse)  => {
  if (instanceOfOcrQuery(message)) {
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
    browser.runtime.sendMessage(screenshotRequest)
    .then(async (screenshotUrl) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;

      const response: Response = await fetch(screenshotUrl)
      if (!response.ok) {
        throw new Error(`Got non-ok response from screenshotUrl fetch ${response}`);
      }
      const screenshotBitmap = await response.blob().then(createImageBitmap)
      ctx.drawImage(screenshotBitmap, left, top, width, height, 0, 0, width, height);

      const croppedImageDataUrl = await canvas.convertToBlob()
      .then((blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result!.toString());
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }));

      let recognizedText: string = '';
      initWorker();
      if (worker) {
        const { data: { text }} = await worker.recognize(canvas);
        recognizedText = text;
      } else {
        throw Error('Worker not constructed');
      }

      const ocrResult: OCR_RESULT = {
        type: 'OCR_RESULT',
        payload: { imageUrl: croppedImageDataUrl, text: recognizedText },
      }
      sendResponse(ocrResult);
    });
    return true;
  } else {
    return false;
  }
});
