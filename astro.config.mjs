import { defineConfig } from "astro/config";
import staticAdapter from "@astrojs/static";

export default defineConfig({
  output: "static",
  adapter: staticAdapter(),
  site: "https://hibberds100.github.io",
  base: "/website-samsara",
});