import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["cloudflare-worker/.wrangler/**", "images/**"],
  },
  {
    ...js.configs.recommended,
    files: ["script.js", "src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ...js.configs.recommended,
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ...js.configs.recommended,
    files: ["cloudflare-worker/src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.serviceworker,
      },
    },
  },
];
