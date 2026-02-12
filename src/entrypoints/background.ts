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
      // TODO: Do validation of sender for most requests.
      if (instanceOfScreenshotRequest(message)) {
        browser.tabs.captureVisibleTab(message.payload.windowId)
          .then(sendResponse);
        return true;
      } else if (instanceOfOffscreenDocumentRequest(message)) {
        setupOffscreenDocument().then(sendResponse);
        return true;
      } else if (instanceOfCanvasScriptPing(message) && sender?.tab) {
        sendResponse({
          tabId: sender.tab.id!,
          windowId: sender.tab.windowId,
        });
        return true;
      } else {
        return false;
      }
    });
    setupOffscreenDocument();
  }
});
