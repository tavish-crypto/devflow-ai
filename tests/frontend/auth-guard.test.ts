import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("../../apps/web/src/lib/supabase", () => ({
  serverClient: async () => ({ auth: { getUser: mocks.user } }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireUser } from "../../apps/web/src/lib/require-user";
afterEach(() => vi.clearAllMocks());
it("requires validated identity for protected pages", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requireUser()).rejects.toThrow("redirect:/login");
});
it("fails closed during auth provider outage", async () => {
  mocks.user.mockRejectedValue(new Error("unavailable"));
  await expect(requireUser()).rejects.toThrow("redirect:/login");
});
it("passes the validated user to private pages", async () => {
  const user = { id: "real-user" };
  mocks.user.mockResolvedValue({ data: { user }, error: null });
  expect(await requireUser()).toEqual(user);
  expect(mocks.redirect).not.toHaveBeenCalled();
});
