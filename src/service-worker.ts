import { injectCanvas } from './square-selector';
import { instanceOfScreenshotRequest, instanceOfOffscreenDocumentRequest } from './messages';

chrome.commands.onCommand.addListener(async (command) => {
  await injectCanvas();
  console.log(`Command: ${command}`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // TODO: Do validation of sender for most requests.
  if (instanceOfScreenshotRequest(message)) {
    chrome.tabs.captureVisibleTab(message.payload.windowId)
      .then(sendResponse);
    return true;
  } else if (instanceOfOffscreenDocumentRequest(message)) {
    setupOffscreenDocument().then(sendResponse);
    return true;
  } else {
    return false;
  }
});

let creatingOffscreenDocument: Promise<void> | null = null;
export const setupOffscreenDocument = async () => {
  const offscreenUrl = chrome.runtime.getURL('src/offscreen/index.html');
  //const offscreenUrl = 'src/offscreen/index.html';
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (existingContexts.length > 0) {
    return;
  }
  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
  } else {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'OCR worker for handeling OCR work tasks centrally.',
    });
    await creatingOffscreenDocument;
    creatingOffscreenDocument = null;
  }
};
setupOffscreenDocument();
