import {
  OCR_QUERY,
  CANVAS_SCRIPT_PING,
} from '@/utils/messages';
import {
  Mouse,
  Rectangle,
} from './types';
import { createResultDiv } from './result-div';

import './style.css';

const rectangleFromMouse = (mouse: Mouse): Rectangle => ({
  left: Math.min(mouse.x, mouse.startX),
  top: Math.min(mouse.y, mouse.startY),
  width: Math.abs(mouse.x - mouse.startX),
  height: Math.abs(mouse.y - mouse.startY),
});

const updateMouse = (
  canvas: HTMLCanvasElement,
  event: MouseEvent,
  mouse: Mouse,
  drawing: boolean,
): void => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  if (drawing) {
    const { left, top, width, height } = rectangleFromMouse(mouse);
    const canvasContext = canvas.getContext('2d')!;
    canvasContext.clearRect(0,0,canvas.width,canvas.height);
    canvasContext.fillRect(0,0,canvas.width,canvas.height);
    canvasContext.clearRect(left,top,width,height);
  }
};

const canvasScript = (container: HTMLElement, tabId: number, windowId: number, destroy: () => void): void => {
  let mouse: Mouse = {
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'root-canvas';
  container.appendChild(canvas);

  const canvasContext = canvas.getContext('2d')!;
  const resizeCanvas = () => {
    canvasContext.canvas.width = window.innerWidth;
    canvasContext.canvas.height = window.innerHeight;
    canvasContext.globalAlpha = 0.5;
    canvasContext.fillRect(0,0,window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const removeCanvas = () => {
    canvas.remove();
    window.removeEventListener('resize', resizeCanvas);
  };
  let drawing: boolean = false;
  canvas.addEventListener('mousemove', (e) => updateMouse(canvas, e, mouse, drawing));
  canvas.addEventListener('click', () => {
    if (drawing) {
      drawing = false;
      canvas.style.cursor = 'default';
      container.style.pointerEvents = 'none';
      removeCanvas();
      const rectangle = rectangleFromMouse(mouse);
      const ocrQuery: OCR_QUERY = {
        type: 'OCR_QUERY',
        payload: {
          tabId, windowId, ...rectangle,
          pixelRatio: window.devicePixelRatio,
        },
      };
      const resultDiv = createResultDiv(ocrQuery, rectangle, destroy);
      container.appendChild(resultDiv);
    } else {
      mouse.startX = mouse.x;
      mouse.startY = mouse.y;
      drawing = true;
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
      const response = await browser.runtime.sendMessage(message)
        .catch(e => {throw Error(e)});
      console.warn(response);
      const { tabId, windowId } = response;
      console.log('Received response on CANVAS_SCRIPT_PING');
      const shadowUi = await createShadowRootUi(ctx, {
        name: 'square-selector',
        position: 'overlay',
        anchor: 'body',
        onMount(container, _shadow, shadowHost) {
          container.style.position = 'fixed';
          canvasScript(container, tabId, windowId, () => shadowHost.remove());
        }
      });
      shadowUi.mount();
    } else {
      console.error('Invalid context');
    }
  }
});

