// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    // Generated API client — never linted (re-run npm run generate:api).
    ignores: ["src/api/generated/**"],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/component-selector": "off",
      "@angular-eslint/directive-selector": "off",
      "@angular-eslint/no-empty-lifecycle-method": "off",
      "@angular-eslint/no-output-native": "off",
      "@angular-eslint/prefer-inject": "off",
      "@angular-eslint/prefer-on-push-component-change-detection": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/ban-tslint-comment": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/alt-text": "off",
      "@angular-eslint/template/click-events-have-key-events": "off",
      "@angular-eslint/template/interactive-supports-focus": "off",
    },
  }
]);
