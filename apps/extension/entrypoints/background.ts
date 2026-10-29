import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { captureTab, readSelection, type Tab } from "../src/capture";
export default defineBackground(() => {
  async function capture(tab: Tab) {
    const result = await captureTab(
      tab,
      async (id) => {
        const results = await browser.scripting.executeScript({
          target: { tabId: id },
          func: readSelection,
        });
        return results[0]?.result;
      },
      (id) => browser.tabs.get(id),
    );
    await browser.storage.local.set({
      captureEvent: { ...result, at: Date.now() },
    });
    return result;
  }
  browser.action.onClicked.addListener((tab) => {
    // Invoke open synchronously in the action user gesture, before any await.
    void browser.sidePanel.open({ windowId: tab.windowId }).catch(() =>
      browser.storage.local.set({
        captureEvent: {
          error:
            "Side panel could not open. Reopen DevFlow from Chrome’s side panel menu.",
          at: Date.now(),
        },
      }),
    );
    void capture(tab);
  });
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      sender.id !== browser.runtime.id ||
      sender.tab ||
      sender.url !== browser.runtime.getURL("/sidepanel.html")
    )
      return;
    if (message?.type !== "capture-active") return;
    // A panel button cannot grant activeTab; it can only reuse an existing toolbar grant.
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) =>
        tabs[0]
          ? capture(tabs[0])
          : { error: "No active tab. Use manual entry." },
      )
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          error:
            "Capture unavailable. Click the DevFlow toolbar icon or enter evidence manually.",
        }),
      );
    return true;
  });
});
