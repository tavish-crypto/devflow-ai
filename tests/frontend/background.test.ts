import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  message: vi.fn(),
  open: vi.fn(),
  inject: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  set: vi.fn(),
}));
vi.mock("wxt/utils/define-background", () => ({
  defineBackground: (main: () => void) => ({ main }),
}));
vi.mock("wxt/browser", () => ({
  browser: {
    action: { onClicked: { addListener: mocks.action } },
    sidePanel: { open: mocks.open },
    scripting: { executeScript: mocks.inject },
    tabs: { get: mocks.get, query: mocks.query },
    storage: { local: { set: mocks.set } },
    runtime: {
      id: "extension-id",
      getURL: (path: string) => `chrome-extension://extension-id${path}`,
      onMessage: { addListener: mocks.message },
    },
  },
}));
import background from "../../apps/extension/entrypoints/background";
import { capture } from "./fixtures";
afterEach(() => vi.resetAllMocks());
it("opens the panel synchronously before capture and persists evidence instead of keeping worker memory", async () => {
  mocks.open.mockResolvedValue(undefined);
  mocks.inject.mockResolvedValue([{ result: capture }]);
  mocks.get.mockResolvedValue({ url: capture.url });
  mocks.set.mockResolvedValue(undefined);
  background.main();
  mocks.action.mock.calls[0][0]({ id: 4, windowId: 1, url: capture.url });
  expect(mocks.open).toHaveBeenCalledWith({ windowId: 1 });
  expect(mocks.open.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.inject.mock.invocationCallOrder[0],
  );
  await vi.waitFor(() =>
    expect(mocks.set).toHaveBeenCalledWith({
      captureEvent: { capture, at: expect.any(Number) },
    }),
  );
});
it("rejects capture requests sent by webpage content scripts or other extensions", () => {
  background.main();
  const listener = mocks.message.mock.calls[0][0];
  const respond = vi.fn();
  listener(
    { type: "capture-active" },
    { id: "evil", url: "https://evil.test" },
    respond,
  );
  listener(
    { type: "capture-active" },
    { id: "extension-id", tab: { id: 4 }, url: "https://webpage.test" },
    respond,
  );
  expect(mocks.query).not.toHaveBeenCalled();
});
