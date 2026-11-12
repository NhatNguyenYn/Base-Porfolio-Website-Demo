import { Be_Vietnam_Pro, Lora } from "next/font/google";

export const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
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
