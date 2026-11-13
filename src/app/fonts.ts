import { Be_Vietnam_Pro, Lora } from "next/font/google";

export const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  // Only weights that the UI actually uses; fewer files, less blocking CSS.
  weight: ["400", "500", "600"],
  variable: "--font-be-vietnam",
  display: "swap",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

export const serif = Lora({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const fontVariables = `${sans.variable} ${serif.variable}`;
