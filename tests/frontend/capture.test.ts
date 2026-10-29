import { describe, expect, it, vi } from "vitest";
import { captureTab } from "../../apps/extension/src/capture";
import { capture } from "./fixtures";
const tab = { id: 4, url: capture.url, windowId: 1 };
describe("user-triggered capture", () => {
  it("captures bounded HTTP evidence from the selected tab", async () => {
    const inject = vi.fn().mockResolvedValue(capture);
    expect(await captureTab(tab, inject, async () => tab)).toEqual({ capture });
    expect(inject).toHaveBeenCalledWith(4);
  });
  it.each([
    "chrome://settings",
    "chrome-extension://id/page",
    "file:///private",
    "about:blank",
    "devtools://console",
  ])("never injects into restricted %s", async (url) => {
    const inject = vi.fn();
    expect(
      (await captureTab({ ...tab, url }, inject, async () => tab)).error,
    ).toMatch(/manual/);
    expect(inject).not.toHaveBeenCalled();
  });
  it("handles missing tabs", async () =>
    expect((await captureTab({ windowId: 1 }, vi.fn(), vi.fn())).error).toMatch(
      /No active tab/,
    ));
  it("offers manual entry for empty selections", async () =>
    expect(
      (
        await captureTab(
          tab,
          async () => ({ ...capture, selectedText: "" }),
          async () => tab,
        )
      ).error,
    ).toMatch(/No selected text/));
  it("rejects navigation during capture", async () =>
    expect(
      (
        await captureTab(
          tab,
          async () => capture,
          async () => ({ url: "https://new.example" }),
        )
      ).error,
    ).toMatch(/navigated/));
  it("handles permission denial", async () =>
    expect(
      (
        await captureTab(
          tab,
          async () => {
            throw new Error("denied");
          },
          async () => tab,
        )
      ).error,
    ).toMatch(/blocked/));
  it("rejects malformed page responses", async () =>
    expect(
      (
        await captureTab(
          tab,
          async () => ({ selectedText: {} }),
          async () => tab,
        )
      ).error,
    ).toBeTruthy());
});
