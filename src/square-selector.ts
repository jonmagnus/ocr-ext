import { OCR_QUERY, OFFSCREEN_DOCUMENT_REQUEST } from './messages';

export const canvasScript = (tabId: number, windowId: number) => {
  console.log(`Received canvasScript with tabId ${tabId}`);
  let mouse = {
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  }
  let rectangle: HTMLDivElement | null = null;
  const canvasWrapper = document.createElement('div');
  canvasWrapper.style.position = 'fixed';
  canvasWrapper.style.left = '0';
  canvasWrapper.style.top = '0';
  canvasWrapper.style.width = '100vw';
  canvasWrapper.style.height = '100vh';
  canvasWrapper.style.zIndex = '999999';
  //canvasWrapper.style.pointerEvents = 'none';
  const canvas = document.createElement('canvas');
  canvasWrapper.appendChild(canvas);
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (rectangle) {
      rectangle.style.width = Math.abs(mouse.x - mouse.startX) + 'px';
      rectangle.style.height = Math.abs(mouse.y - mouse.startY) + 'px';
      rectangle.style.left = Math.min(mouse.x, mouse.startX) + 'px';
      rectangle.style.top = Math.min(mouse.y, mouse.startY) + 'px';
    }
  });
  canvas.addEventListener('click', () => {
    if (rectangle) {
      rectangle.remove();
      rectangle = null;
      canvas.style.cursor = 'default';
      canvasWrapper.style.pointerEvents = 'none';
      canvas.remove();
      const left = Math.min(mouse.x, mouse.startX);
      const top = Math.min(mouse.y, mouse.startY);
      const width = Math.abs(mouse.x - mouse.startX);
      const height = Math.abs(mouse.y - mouse.startY);
      const offscreenDocumentRequest: OFFSCREEN_DOCUMENT_REQUEST = {
        type: 'OFFSCREEN_DOCUMENT_REQUEST',
      };
      const ocrQuery: OCR_QUERY = {
        type: 'OCR_QUERY',
        payload: {
          tabId, windowId, top, left, width, height,
          pixelRatio: window.devicePixelRatio,
        },
      };
      chrome.runtime.sendMessage(offscreenDocumentRequest)
      .then(() => chrome.runtime.sendMessage(ocrQuery))
      .then((m) => {
        if (m?.type == 'OCR_RESULT') {
          const resultDiv = document.createElement('div');
          const textContainer = document.createElement('p');
          textContainer.innerHTML = m.payload.text;
          const croppedImageContainer = document.createElement('img');
          croppedImageContainer.src = m.payload.imageUrl;
          croppedImageContainer.width = ocrQuery.payload.width;
          resultDiv.appendChild(croppedImageContainer);
          resultDiv.appendChild(textContainer);
          resultDiv.style.position = 'absolute';
          resultDiv.style.backgroundColor = 'white';
          resultDiv.style.width = width + 'px';
          resultDiv.style.top = top + 'px';
          resultDiv.style.left = left + 'px';
          resultDiv.style.pointerEvents = 'auto';
          resultDiv.onclick = canvasWrapper.remove;
          canvasWrapper.appendChild(resultDiv);
        } else {
          throw Error(`Did not receive OCR_RESULT from OCR_QUERY: ${m}`);
        }
      }).catch(e => console.warn(e));
    } else {
      mouse.startX = mouse.x;
      mouse.startY = mouse.y;
      rectangle = document.createElement('div');
      rectangle.className = 'rectangle';
      rectangle.style.border = '1px solid #FF0000';
      rectangle.style.position = 'absolute';
      rectangle.style.left = mouse.x + 'px';
      rectangle.style.top = mouse.x + 'px';
      canvasWrapper.appendChild(rectangle);
      canvas.style.cursor = 'crosshair';
    }
  });

  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';

  const ctx = canvas.getContext('2d')!;
  if (!ctx) {
    console.warn('Canvas context is null');
    return;
  }
  ctx.canvas.width = window.innerWidth;
  ctx.canvas.height = window.innerHeight;
  document.body.insertBefore(canvasWrapper, document.body.firstChild)
};

export const injectCanvas = async () => {
  let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: canvasScript,
      args: [tab.id, tab.windowId],
    }).then(() => console.log('Script injected'));
  }
};
