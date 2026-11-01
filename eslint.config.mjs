import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "coverage/**", "test/fixtures/**"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
];
