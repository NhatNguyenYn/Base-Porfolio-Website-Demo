// Self-hosted fonts — see ./fonts.css for the full story.
//
// Previously this file used next/font/google (Be_Vietnam_Pro + Lora).
// That loader fetches CSS from Google Fonts at BUILD time and parses it
// with a regex; in GitHub Actions CI the fetch intermittently returns CSS
// the parser cannot handle, failing the build with
// "TypeError: Cannot read properties of null (reading '1')" in
// next/dist/compiled/@next/font/dist/google/loader.js — even though the
// same build passes locally and in the Pages workflow.
//
// The fonts are now self-hosted: woff2 files live in ./fonts/ and the
// @font-face rules (verbatim from Google's css2 responses, same families,
// weights, styles, subsets, unicode-range, display=swap and fallback
// metrics) plus the --font-be-vietnam / --font-lora CSS variables live in
// ./fonts.css, imported from ./globals.css.
//
// fontVariables is kept (as an empty string) so the three layouts that
// use it as the <html> className do not need to change; the variables are
// defined on :root in fonts.css instead of on a generated class.

export const fontVariables = "";
