import {
  OCR_QUERY,
  OFFSCREEN_DOCUMENT_REQUEST,
  CANVAS_SCRIPT_PING,
} from '@/utils/messages';

import './style.css';

const canvasScript = (container: HTMLElement, tabId: number, windowId: number) => {
  console.log(`Received canvasScript with tabId ${tabId}`);
  let mouse = {
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  }
  let rectangle: HTMLDivElement | null = null;
  const canvas = document.createElement('canvas');
  canvas.className = 'root-canvas';
  container.appendChild(canvas);

  const canvasContext = canvas.getContext('2d')!;
  if (!canvasContext) {
    console.warn('Canvas context is null');
    return;
  }
  const resizeCanvas = () => {
    canvasContext.canvas.width = window.innerWidth;
    canvasContext.canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeCanvas);
  const removeCanvas = () => {
    canvas.remove();
    window.removeEventListener('resize', resizeCanvas);
  };
  resizeCanvas();
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
      container.style.pointerEvents = 'none';
      removeCanvas();
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
      browser.runtime.sendMessage(offscreenDocumentRequest)
      .then(() => browser.runtime.sendMessage(ocrQuery))
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
          resultDiv.className = 'result-div';
          resultDiv.style.width = width + 'px';
          resultDiv.style.top = top + 'px';
          resultDiv.style.left = left + 'px';
          resultDiv.onclick = container.remove;
          container.appendChild(resultDiv);
        } else {
          throw Error(`Did not receive OCR_RESULT from OCR_QUERY: ${m}`);
        }
      }).catch(e => console.warn(e));
    } else {
      mouse.startX = mouse.x;
      mouse.startY = mouse.y;
      rectangle = document.createElement('div');
      rectangle.className = 'rectangle';
      rectangle.style.left = mouse.x + 'px';
      rectangle.style.top = mouse.x + 'px';
      container.appendChild(rectangle);
    }
  });
}

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    if (ctx!.isValid) {
      const message: CANVAS_SCRIPT_PING = {
        type: 'CANVAS_SCRIPT_PING',
      }
      console.log('Sending CANVAS_SCRIPT_PING');
      const { tabId, windowId  } = await browser.runtime.sendMessage(message);
      console.log('Received response on CANVAS_SCRIPT_PING');
      const shadowUi = await createShadowRootUi(ctx, {
        name: 'square-selector',
        position: 'overlay',
        anchor: 'body',
        onMount(container) {
          container.style.position = 'fixed';
          canvasScript(container, tabId, windowId);
        }
      });
      shadowUi.mount();
    } else {
      console.error('Invalid context');
    }
  }
});

