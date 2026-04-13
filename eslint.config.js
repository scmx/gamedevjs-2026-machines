import js from "@eslint/js"

export default [
  {
    ignores: ["node_modules/**", "case-study-*/**", "**/dist/**", "zzfx.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        clearInterval: "readonly",
        console: "readonly",
        devicePixelRatio: "readonly",
        document: "readonly",
        Element: "readonly",
        globalThis: "readonly",
        addEventListener: "readonly",
        HTMLCanvasElement: "readonly",
        innerHeight: "readonly",
        innerWidth: "readonly",
        location: "readonly",
        navigator: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        setInterval: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
]
