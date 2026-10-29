import { defineConfig } from "wxt";
import { DEVFLOW_MANIFEST_KEY } from "./src/manifest-key";
const backend = new URL(
  process.env.VITE_DEVFLOW_APP_URL || "http://localhost:3000",
);
if (
  backend.protocol !== "https:" &&
  !(backend.protocol === "http:" && backend.hostname === "localhost")
)
  throw new Error(
    "Extension backend must use HTTPS (or localhost for development)",
  );
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    define: { __DEVFLOW_ORIGIN__: JSON.stringify(backend.origin) },
  }),
  manifest: {
    name: "DevFlow AI",
    key: DEVFLOW_MANIFEST_KEY,
    description: "Capture evidence for user-reviewed issue reports.",
    permissions: ["activeTab", "scripting", "sidePanel", "storage"],
    host_permissions: [`${backend.origin}/*`],
    action: { default_title: "Capture selection with DevFlow" },
    minimum_chrome_version: "116",
  },
});
