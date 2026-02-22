import {
  instanceOfScreenshotRequest,
  instanceOfOffscreenDocumentRequest,
  instanceOfCanvasScriptPing,
} from '@/utils/messages';

const injectCanvas = async () => {
  let [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) {
    browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/square-selector.js'],
    })
    .then(
      () => console.log('Script injected'),
      (e) => console.warn(e),
    );
  }
};

let creatingOffscreenDocument: Promise<void> | null = null;
export const setupOffscreenDocument = async () => {
  const offscreenUrl = browser.runtime.getURL('/offscreen.html');
  const existingContexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (existingContexts.length > 0) {
    return;
  }
  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
  } else {
    creatingOffscreenDocument = browser.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [browser.offscreen.Reason.WORKERS],
      justification: 'OCR worker for handeling OCR work tasks centrally.',
    });
    await creatingOffscreenDocument;
    creatingOffscreenDocument = null;
  }
};

export default defineBackground({
  type: 'module',
  main() {
    browser.commands.onCommand.addListener(async (command) => {
      await injectCanvas();
      console.log(`Command: ${command}`);
    });

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Received message i background: ', message);
      // TODO: Do validation of sender for most requests.
      switch (true) {
        case instanceOfScreenshotRequest(message):
          browser.tabs.captureVisibleTab(message.payload.windowId)
            .then(sendResponse);
          return true;
        case instanceOfOffscreenDocumentRequest(message):
          setupOffscreenDocument().then(sendResponse);
          return true;
        //case instanceOfCanvasScriptPing(message) && sender?.tab:
        case instanceOfCanvasScriptPing(message):
          console.log('Received canvas script ping!', sender.tab);
          sendResponse({
            tabId: sender.tab!.id!,
            windowId: sender.tab!.windowId,
          });
          return true;
        default:
          return false;
      }
    });
    setupOffscreenDocument();
  }
});
