import { createWorker } from 'tesseract.js';

console.log('Adding screenshot button event listener');
export const setupScreenshot = (
  button: HTMLButtonElement,
  divContainer: HTMLDivElement,
  //imageContainer: HTMLImageElement,
) => {
  button.addEventListener('click', async () => {
    const screenshotUrl = await chrome.tabs.captureVisibleTab();
    const imageContainer = document.createElement('img');
    const translationContainer = document.createElement('p');
    const translateButton = document.createElement('button');
    imageContainer.width = 500;
    translateButton.innerHTML = 'Translate';
    let progressBars = new Map<string, HTMLProgressElement>();
    translateButton.onclick = async () => {
      const worker = await createWorker('chi_sim', 1, {
        workerPath: chrome.runtime.getURL('node_modules/tesseract.js/dist/worker.min.js'),
        corePath: chrome.runtime.getURL('node_modules/tesseract.js/node_modules/tesseract.js-core/'),
        //corePath: chrome.runtime.getURL('node_modules/tesseract.js-core/tesseract-core.wasm.js'),
        //langPath: chrome.runtime.getURL('node_modules/@tesseract.js-data/'),
        workerBlobURL: false,
        logger: (m) => {
          console.log(m)
          if (m.progress !== undefined) {
            let bar = progressBars.get(m.status);
            if (bar) {
              bar.value = m.progress;
            } else {
              const progressDiv = document.createElement('div');
              progressDiv.innerHTML = `<p>${m.status}</p>`;
              bar = document.createElement('progress');
              bar.value = m.progress;
              bar.max = 1;
              progressDiv.appendChild(bar);
              divContainer.appendChild(progressDiv);
              progressBars.set(m.status, bar);
            }
          }
        },
      }).catch(e => console.warn(JSON.stringify(e, null, 2)));
      if (!worker) {
        throw Error('Worker not constructed in popup.');
      };
      const { data: { text } } = await worker.recognize(screenshotUrl);
      translationContainer.innerHTML = text;
      await worker.terminate();
    }
    imageContainer.src = screenshotUrl;
    divContainer.appendChild(imageContainer);
    divContainer.appendChild(translationContainer);
    divContainer.appendChild(translateButton);
  });
};
