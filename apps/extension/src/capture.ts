import { CaptureInputSchema, type CaptureInput } from "@devflow/contracts";
export type CaptureResult = { capture?: CaptureInput; error?: string };
export type Tab = { id?: number; url?: string; windowId: number };
export function readSelection() {
  return {
    pageTitle: document.title.slice(0, 500),
    url: location.href.slice(0, 2048),
    selectedText: (window.getSelection()?.toString() ?? "").slice(0, 16000),
    capturedAt: new Date().toISOString(),
  };
}
export async function captureTab(
  tab: Tab,
  inject: (id: number) => Promise<unknown>,
  current: (id: number) => Promise<{ url?: string }>,
): Promise<CaptureResult> {
  if (tab.id === undefined)
    return {
      error: "No active tab. Open a webpage, or enter your evidence manually.",
    };
  if (!tab.url || !/^https?:\/\//.test(tab.url))
    return {
      error:
        "Chrome does not allow capture on this page. Use manual entry for relevant evidence.",
    };
  try {
    const raw = await inject(tab.id);
    const next = await current(tab.id);
    if (next.url !== tab.url)
      return {
        error:
          "The page navigated during capture. Select the error again and click the DevFlow toolbar icon.",
      };
    const parsed = CaptureInputSchema.safeParse(raw);
    if (!parsed.success)
      return {
        error:
          "No selected text was found. Select the error and click the toolbar icon again, or enter it manually.",
      };
    if (parsed.data.url !== tab.url)
      return {
        error: "The page changed during capture. Please capture again.",
      };
    return { capture: parsed.data };
  } catch {
    return {
      error:
        "Chrome blocked this capture or the tab closed. Try the toolbar icon again, or use manual entry.",
    };
  }
}
