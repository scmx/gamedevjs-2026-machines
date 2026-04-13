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
        globalThis: "readonly",
        HTMLCanvasElement: "readonly",
        innerHeight: "readonly",
        innerWidth: "readonly",
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
