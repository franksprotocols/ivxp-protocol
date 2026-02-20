// @ts-expect-error - No type definitions for tailwind-plugin yet
import { createPreset } from "fumadocs-ui/tailwind-plugin";

/** @type {import('tailwindcss').Config} */
const config = {
  presets: [createPreset()],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./node_modules/fumadocs-ui/dist/**/*.js",
  ],
};

export default config;
