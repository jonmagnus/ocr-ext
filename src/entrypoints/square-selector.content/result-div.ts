import {
  OCR_QUERY,
  offscreenDocumentRequest,
} from '@/utils/messages';
import { Rectangle } from './types';
import { createTokenContainer } from './token-container'

export const createResultDiv = (
  ocrQuery: OCR_QUERY,
  rectangle: Rectangle,
  destroy: () => void,
): HTMLDivElement => {
  const resultDiv = document.createElement('div');
  resultDiv.className = 'result-div';
  resultDiv.style.top = rectangle.top + 'px';
  resultDiv.style.left = rectangle.left + 'px';
  resultDiv.style.width = rectangle.width + 'px';
  resultDiv.onclick = destroy;

  setupResultDiv(resultDiv, ocrQuery, rectangle);
  return resultDiv;
};


const setupResultDiv = async (
  resultDiv: HTMLDivElement,
  ocrQuery: OCR_QUERY,
  rectangle: Rectangle,
): Promise<void> => {
  const progressElement = document.createElement('progress');
  progressElement.id = 'ocr-progress';
  resultDiv.appendChild(progressElement);

  const offscreenDocumentRequest: OFFSCREEN_DOCUMENT_REQUEST = {
    type: 'OFFSCREEN_DOCUMENT_REQUEST',
  };
  await browser.runtime.sendMessage(offscreenDocumentRequest)

  const ocrResult: OCR_RESULT = await browser.runtime.sendMessage(ocrQuery)
  if (ocrResult?.type != 'OCR_RESULT') {
    throw Error(`Did not receive OCR_RESULT from OCR_QUERY: ${JSON.stringify(ocrResult, null, 2)}`);
  }
  

  const croppedImageContainer = document.createElement('img');
  croppedImageContainer.src = ocrResult.payload.imageUrl;
  croppedImageContainer.style.width = rectangle.width + 'px';
  progressElement.remove();
  resultDiv.appendChild(croppedImageContainer);

  const tokenizeRequest: TOKENIZE_REQUEST = {
    type: 'TOKENIZE_REQUEST',
    payload: {
      text: ocrResult.payload.text,
    },
  };
  const tokenizeResponse: TOKENIZE_RESPONSE = await browser.runtime.sendMessage(tokenizeRequest);
  if (tokenizeResponse?.type != 'TOKENIZE_RESPONSE') {
    throw Error(`Did not receive TOKENIZE_RESPONSE from TOKENIZE_REQUEST: ${JSON.stringify(tokenizeResponse, null, 2)}`);
  }

  const tokenContainer = createTokenContainer(tokenizeResponse.payload.annotation);
  resultDiv.appendChild(tokenContainer);
}
