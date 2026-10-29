import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "DevFlow AI",
    description: "Capture evidence for user-reviewed issue reports.",
    permissions: ["activeTab"],
  },
});
