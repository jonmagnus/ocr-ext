import { WordAnnotation } from './types'

export type OCR_QUERY = {
  type: 'OCR_QUERY',
  payload: {
    tabId: number,
    windowId: number,
    width: number,
    height: number,
    top: number,
    left: number,
    pixelRatio: number,
  },
};

export const instanceOfOcrQuery = (m: any): m is OCR_QUERY => {
  return m && 'type' in m && m.type == 'OCR_QUERY';
}

export type OCR_RESULT = {
  type: 'OCR_RESULT',
  payload: {
    imageUrl: string,
    text: string,
  },
};

export const instanceOfOcrResult = (m: any): m is OCR_RESULT => {
  return m && 'type' in m && m.type == 'OCR_RESULT';
}

export type SCREENSHOT_REQUEST = {
  type: 'SCREENSHOT_REQUEST',
  payload: {
    windowId: number,
  },
};

export const instanceOfScreenshotRequest = (m: any): m is SCREENSHOT_REQUEST => {
  return m && 'type' in m && m.type == 'SCREENSHOT_REQUEST';
}


export type OFFSCREEN_DOCUMENT_REQUEST = {
  type: 'OFFSCREEN_DOCUMENT_REQUEST',
};

export const instanceOfOffscreenDocumentRequest = (m: any): m is OFFSCREEN_DOCUMENT_REQUEST => {
  return m && 'type' in m && m.type == 'OFFSCREEN_DOCUMENT_REQUEST';
}

export type CANVAS_SCRIPT_PING = {
  type: 'CANVAS_SCRIPT_PING',
};

export const instanceOfCanvasScriptPing = (m: any): m is CANVAS_SCRIPT_PING => {
  return m && 'type' in m && m.type == 'CANVAS_SCRIPT_PING';
}

export type TOKENIZE_REQUEST = {
  type: 'TOKENIZE_REQUEST',
  payload: {
    text: string,
  },
};

export const instanceOfTokenizeRequest = (m: any): m is TOKENIZE_REQUEST => {
  return m?.type == 'TOKENIZE_REQUEST';
}

export type TOKENIZE_RESPONSE = {
  type: 'TOKENIZE_RESPONSE',
  payload: {
    cut: Array<string>,
    annotation: Array<WordAnnotation>
  },
};

export const instanceOfTokenizeResponse = (m: any): m is TOKENIZE_RESPONSE => {
  return m?.type == 'TOKENIZE_RESPONSE';
}
