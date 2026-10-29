import { describe, it, expect } from "vitest";
import { createHash, createPublicKey } from "node:crypto";
import {
  DEVFLOW_MANIFEST_KEY,
  DEVFLOW_EXTENSION_ID,
} from "../../apps/extension/src/manifest-key";
describe("stable unpacked extension identity", () => {
  it("contains only a valid public RSA key", () => {
    const key = createPublicKey({
      key: Buffer.from(DEVFLOW_MANIFEST_KEY, "base64"),
      type: "spki",
      format: "der",
    });
    expect(key.type).toBe("public");
    expect(key.asymmetricKeyType).toBe("rsa");
  });
  it("derives the declared Chrome extension ID from the public key", () => {
    const hex = createHash("sha256")
      .update(Buffer.from(DEVFLOW_MANIFEST_KEY, "base64"))
      .digest("hex")
      .slice(0, 32);
    const id = [...hex]
      .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
      .join("");
    expect(DEVFLOW_EXTENSION_ID).toMatch(/^[a-p]{32}$/);
    expect(id).toBe(DEVFLOW_EXTENSION_ID);
  });
});
