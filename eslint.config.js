import js from "@eslint/js"

export default [
  {
    ignores: [
      "node_modules/**",
      "case-study-*/**",
      "**/dist/**",
      "zzfx.js",
      "zzfxm.js",
    ],
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
        localStorage: "readonly",
        location: "readonly",
        navigator: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        setInterval: "readonly",
        URLSearchParams: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
]
