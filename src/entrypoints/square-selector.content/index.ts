import {
  OCR_QUERY,
  OFFSCREEN_DOCUMENT_REQUEST,
  CANVAS_SCRIPT_PING,
} from '@/utils/messages';

import './style.css';

type Mouse = {
  x: number,
  y: number,
  startX: number,
  startY: number,
};

type Rectangle = {
  top: number,
  left: number,
  height: number,
  width: number,
};

const rectangleFromMouse = (mouse: Mouse): Rectangle => ({
  left: Math.min(mouse.x, mouse.startX),
  top: Math.min(mouse.y, mouse.startY),
  width: Math.abs(mouse.x - mouse.startX),
  height: Math.abs(mouse.y - mouse.startY),
});

const updateMouse = (
  event: MouseEvent,
  mouse: Mouse,
  rectangle: HTMLDivElement | null,
) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  if (rectangle) {
    const { left, top, width, height } = rectangleFromMouse(mouse);
    [
      rectangle.style.left,
      rectangle.style.top,
      rectangle.style.width,
      rectangle.style.height,
    ] = [left, top, width, height].map(v => v + 'px');
  }
};

const createResultDiv = (message: OCR_RESULT, rectangle: Rectangle): HTMLDivElement => {
  const resultDiv = document.createElement('div');
  const textContainer = document.createElement('p');
  textContainer.innerHTML = message.payload.text;
  const croppedImageContainer = document.createElement('img');
  croppedImageContainer.src = message.payload.imageUrl;
  resultDiv.appendChild(croppedImageContainer);
  resultDiv.appendChild(textContainer);
  resultDiv.className = 'result-div';
  resultDiv.style.top = rectangle.top + 'px';
  resultDiv.style.left = rectangle.left + 'px';
  resultDiv.style.width = rectangle.width + 'px';
  return resultDiv;
};

const canvasScript = (container: HTMLElement, tabId: number, windowId: number) => {
  console.log(`Received canvasScript with tabId ${tabId}`);
  let mouse: Mouse = {
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  }
  let rectangleDiv: HTMLDivElement | null = null;
  const canvas = document.createElement('canvas');
  canvas.className = 'root-canvas';
  container.appendChild(canvas);

  const canvasContext = canvas.getContext('2d')!;
  const resizeCanvas = () => {
    canvasContext.canvas.width = window.innerWidth;
    canvasContext.canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const removeCanvas = () => {
    canvas.remove();
    window.removeEventListener('resize', resizeCanvas);
  };
  canvas.addEventListener('mousemove', (e) => updateMouse(e, mouse, rectangleDiv));
  canvas.addEventListener('click', () => {
    if (rectangleDiv) {
      rectangleDiv.remove();
      rectangleDiv = null;
      canvas.style.cursor = 'default';
      container.style.pointerEvents = 'none';
      removeCanvas();
      const offscreenDocumentRequest: OFFSCREEN_DOCUMENT_REQUEST = {
        type: 'OFFSCREEN_DOCUMENT_REQUEST',
      };
      const rectangle = rectangleFromMouse(mouse);
      const ocrQuery: OCR_QUERY = {
        type: 'OCR_QUERY',
        payload: {
          tabId, windowId, ...rectangle,
          pixelRatio: window.devicePixelRatio,
        },
      };
      browser.runtime.sendMessage(offscreenDocumentRequest)
      .then(() => browser.runtime.sendMessage(ocrQuery))
      .then((message) => {
        if (message?.type == 'OCR_RESULT') {
          const resultDiv = createResultDiv(message, rectangle);
          resultDiv.onclick = container.remove;
          container.appendChild(resultDiv);
        } else {
          throw Error(`Did not receive OCR_RESULT from OCR_QUERY: ${m}`);
        }
      }).catch(e => console.warn(e));
    } else {
      mouse.startX = mouse.x;
      mouse.startY = mouse.y;
      rectangleDiv = document.createElement('div');
      rectangleDiv.className = 'rectangle';
      rectangleDiv.style.left = mouse.x + 'px';
      rectangleDiv.style.top = mouse.x + 'px';
      container.appendChild(rectangleDiv);
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

