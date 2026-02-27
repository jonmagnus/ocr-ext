import { LoggerMessage } from 'tesseract.js';
import { instanceOfOcrQuery } from '@/utils/messages'
import { handleOcrRequest, initWorker } from './ocr-handler'
import { handleTokenizeRequest } from './tokenization-handler'

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
  } else {
    console.log('Worker log:', m);
  }
}

const logDivErrorHandler = (e: Error) => {
  console.warn('Worker: ', e);
  const errorP = document.createElement('p');
  errorP.innerHTML = JSON.stringify(e, null, 2);
  errorP.style.backgroundColor = 'red';
  const pDiv = document.createElement('div');
  pDiv.appendChild(errorP);
  logDiv.append(pDiv);
}
initWorker(logDivLogger, logDivErrorHandler);

browser.runtime.onMessage.addListener((message, _sender, sendResponse)  => {
  console.log('Received message in offscreen: ', message);
  switch (true) {
    case instanceOfOcrQuery(message):
      handleOcrRequest(message, logDivLogger, logDivErrorHandler)
      .then(sendResponse);
      return true;
    case instanceOfTokenizeRequest(message):
      handleTokenizeRequest(message)
      .then(sendResponse);
      return true;
    default:
      return false;
  }
});
