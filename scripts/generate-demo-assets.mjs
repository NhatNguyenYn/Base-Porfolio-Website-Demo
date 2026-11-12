// Generates deterministic abstract SVG placeholders for the demo content.
// Run with: node scripts/generate-demo-assets.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/demo";
mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = {
  navy: ["#101B2E", "#20304B", "#7E93B8", "#D9CBBA"],
  terracotta: ["#F3E7DA", "#D9B49B", "#A15C46", "#2A1F1A"],
  forest: ["#0D2620", "#1D4338", "#7FA792", "#E4EEE7"],
  dusk: ["#191430", "#382D5A", "#8D7CC6", "#E8E3F6"],
  stone: ["#DED9CE", "#BEB5A4", "#6C6455", "#211F1A"],
  ocean: ["#091F2F", "#134059", "#5D9CB7", "#DBEAF1"],
  ochre: ["#2A2719", "#5A5331", "#C2A65A", "#F3E9D1"],
  rose: ["#F2E4E2", "#D5A5A3", "#8A4950", "#281A1D"],
};

function grain(id) {
  return `
    <filter id="grain-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" result="noise" />
      <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
      <feComponentTransfer in="mono" result="faded">
        <feFuncA type="linear" slope="0.16" />
      </feComponentTransfer>
    </filter>`;
}

function blob(id, x, y, radius, color, opacity) {
  return `
    <radialGradient id="rg-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="${opacity}" />
      <stop offset="70%" stop-color="${color}" stop-opacity="${opacity * 0.35}" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0" />
    </radialGradient>
    <circle cx="${x}" cy="${y}" r="${radius}" fill="url(#rg-${id})" />`;
}

function artworkSvg({ width, height, seed, palette, id }) {
  const [a, b, c, d] = PALETTES[palette];
  const random = rng(seed);
  const blobs = Array.from({ length: 4 })
    .map((_, index) => {
      const x = Math.round(random() * width);
      const y = Math.round(random() * height);
      const radius = Math.round((0.28 + random() * 0.35) * Math.min(width, height) * 1.15);
      const color = [c, d, b, c][index % 4];
      return blob(`${id}-${index}`, x, y, radius, color, 0.4 + random() * 0.25);
    })
    .join("");

  const arcX = Math.round(width * (0.2 + random() * 0.5));
  const arcY = Math.round(height * (0.3 + random() * 0.4));
  const arcR = Math.round(Math.min(width, height) * (0.24 + random() * 0.2));
  const lineY = Math.round(height * (0.55 + random() * 0.25));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}" />
      <stop offset="60%" stop-color="${b}" />
      <stop offset="100%" stop-color="${a}" />
    </linearGradient>
    ${grain(id)}
    <filter id="soft-${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${Math.round(Math.min(width, height) * 0.02)}" />
    </filter>
    ${blobs}
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg-${id})" />
  <g filter="url(#soft-${id})">${blobs}</g>

  <rect x="${Math.round(width * 0.63)}" y="${Math.round(height * 0.06)}" width="${Math.round(width * 0.26)}" height="${Math.round(height * 0.52)}" fill="${d}" fill-opacity="0.05" />
  <line x1="${Math.round(width * 0.18)}" y1="0" x2="${Math.round(width * 0.18)}" y2="${height}" stroke="${d}" stroke-opacity="0.09" stroke-width="1" />
  <line x1="${Math.round(width * 0.63)}" y1="0" x2="${Math.round(width * 0.63)}" y2="${height}" stroke="${d}" stroke-opacity="0.12" stroke-width="1" />
  <line x1="${Math.round(width * 0.89)}" y1="0" x2="${Math.round(width * 0.89)}" y2="${height}" stroke="${d}" stroke-opacity="0.08" stroke-width="1" />
  <circle cx="${arcX}" cy="${arcY}" r="${arcR}" fill="none" stroke="${d}" stroke-opacity="0.42" stroke-width="${Math.max(1, Math.round(width * 0.003))}" />
  <circle cx="${arcX}" cy="${arcY}" r="${Math.round(arcR * 0.62)}" fill="none" stroke="${c}" stroke-opacity="0.35" stroke-width="1" />
  <circle cx="${Math.round(width * 0.76)}" cy="${Math.round(height * 0.66)}" r="${Math.round(Math.min(width, height) * 0.008)}" fill="${d}" fill-opacity="0.65" />
  <path d="M0 ${lineY} H${width}" stroke="${d}" stroke-opacity="0.22" stroke-width="1" />
  <path d="M${Math.round(width * 0.72)} ${Math.round(height * 0.16)} L${Math.round(width * 0.88)} ${Math.round(height * 0.16)}" stroke="${d}" stroke-opacity="0.55" stroke-width="${Math.max(2, width * 0.006)}" />
  <circle cx="${Math.round(width * 0.15)}" cy="${Math.round(height * 0.78)}" r="${Math.round(Math.min(width, height) * 0.014)}" fill="${d}" fill-opacity="0.8" />
  <rect width="${width}" height="${height}" filter="url(#grain-${id})" opacity="0.5" style="mix-blend-mode:overlay" />
</svg>`;
}

function coverSvg({ width, height, seed, palette, id, variant }) {
  const [a, b, c, d] = PALETTES[palette];
  const random = rng(seed);
  const circleX = Math.round(width * (variant === "alt" ? 0.68 : 0.3));
  const circleY = Math.round(height * 0.42);
  const circleR = Math.round(Math.min(width, height) * 0.3);
  const bandY = Math.round(height * 0.62);

  const gridLines = Array.from({ length: 6 })
    .map((_, index) => {
      const x = Math.round((width / 6) * (index + 1));
      return `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${d}" stroke-opacity="0.08" stroke-width="1" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="cbg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}" />
      <stop offset="100%" stop-color="${b}" />
    </linearGradient>
    <linearGradient id="band-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.85" />
      <stop offset="100%" stop-color="${c}" stop-opacity="0.1" />
    </linearGradient>
    ${grain(id)}
    <filter id="blur-${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${Math.round(height * 0.04)}" />
    </filter>
    <radialGradient id="glow-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${d}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${d}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#cbg-${id})" />
  <g opacity="0.9">${gridLines}</g>

  <circle cx="${circleX}" cy="${circleY}" r="${Math.round(circleR * 1.45)}" fill="url(#glow-${id})" filter="url(#blur-${id})" />
  <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="${c}" fill-opacity="0.22" stroke="${d}" stroke-opacity="0.5" stroke-width="1.5" />
  <circle cx="${circleX}" cy="${circleY}" r="${Math.round(circleR * 0.55)}" fill="none" stroke="${d}" stroke-opacity="0.3" stroke-width="1" />

  <rect x="0" y="${bandY}" width="${width}" height="${Math.round(height * 0.16)}" fill="url(#band-${id})" opacity="0.55" />
  <rect x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.82)}" width="${Math.round(width * 0.28)}" height="2" fill="${d}" fill-opacity="0.45" />
  <rect x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.86)}" width="${Math.round(width * (0.1 + random() * 0.12))}" height="2" fill="${d}" fill-opacity="0.2" />
  <circle cx="${width - Math.round(width * 0.12)}" cy="${Math.round(height * 0.2)}" r="4" fill="${d}" fill-opacity="0.9" />
  <rect width="${width}" height="${height}" filter="url(#grain-${id})" opacity="0.45" style="mix-blend-mode:overlay" />
</svg>`;
}

function avatarSvg() {
  const width = 900;
  const height = 1125;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="abg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#EDE9E1" />
      <stop offset="100%" stop-color="#D5D2C8" />
    </linearGradient>
    <linearGradient id="figure" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#26334A" />
      <stop offset="100%" stop-color="#111B2B" />
    </linearGradient>
    ${grain("avatar")}
    <radialGradient id="halo" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#E3DED2" />
      <stop offset="100%" stop-color="#E3DED2" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#abg)" />
  <circle cx="${width / 2}" cy="${height * 0.44}" r="${width * 0.38}" fill="url(#halo)" />
  <circle cx="${width / 2}" cy="${height * 0.4}" r="${width * 0.34}" fill="none" stroke="#17233A" stroke-opacity="0.12" stroke-width="1" />
  <circle cx="${width * 0.5}" cy="${height * 0.4}" r="${width * 0.295}" fill="none" stroke="#17233A" stroke-opacity="0.14" stroke-width="1" />
  <g fill="url(#figure)">
    <rect x="${width * 0.455}" y="${height * 0.48}" width="${width * 0.09}" height="${height * 0.24}" />
    <circle cx="${width * 0.5}" cy="${height * 0.4}" r="${width * 0.165}" />
    <path d="M${-width * 0.08} ${height * 1.06}
             C ${width * 0.02} ${height * 0.845}, ${width * 0.2} ${height * 0.705}, ${width * 0.5} ${height * 0.705}
             C ${width * 0.8} ${height * 0.705}, ${width * 0.98} ${height * 0.845}, ${width * 1.08} ${height * 1.06} Z" />
  </g>
  <circle cx="${width * 0.79}" cy="${height * 0.15}" r="5" fill="#536DFE" />
  <path d="M${width * 0.1} ${height * 0.16} V ${height * 0.1} H${width * 0.18}" stroke="#17233A" stroke-opacity="0.35" stroke-width="1.5" fill="none" />
  <path d="M${width * 0.14} ${height * 0.93} H${width * 0.3}" stroke="#EDE9E1" stroke-opacity="0.5" stroke-width="1.5" />
  <rect width="${width}" height="${height}" filter="url(#grain-avatar)" opacity="0.5" style="mix-blend-mode:overlay" />
</svg>`;
}

const artworks = [
  { id: "art-01", palette: "navy", w: 900, h: 1200, seed: 12 },
  { id: "art-02", palette: "terracotta", w: 1200, h: 900, seed: 27 },
  { id: "art-03", palette: "forest", w: 900, h: 1400, seed: 41 },
  { id: "art-04", palette: "dusk", w: 1000, h: 1000, seed: 58 },
  { id: "art-05", palette: "stone", w: 1200, h: 800, seed: 73 },
  { id: "art-06", palette: "ocean", w: 900, h: 1100, seed: 88 },
  { id: "art-07", palette: "ochre", w: 1000, h: 1300, seed: 95 },
  { id: "art-08", palette: "rose", w: 1200, h: 900, seed: 111 },
];

for (const art of artworks) {
  writeFileSync(
    `${OUT}/${art.id}.svg`,
    artworkSvg({ width: art.w, height: art.h, seed: art.seed, palette: art.palette, id: art.id }),
  );
}

const covers = [
  { id: "project-01", palette: "navy", variant: "alt", seed: 5 },
  { id: "project-02", palette: "ocean", variant: "main", seed: 18 },
  { id: "project-03", palette: "ochre", variant: "alt", seed: 33 },
  { id: "project-04", palette: "stone", variant: "main", seed: 47 },
  { id: "article-01", palette: "dusk", variant: "main", seed: 61 },
  { id: "article-02", palette: "forest", variant: "alt", seed: 76 },
  { id: "article-03", palette: "terracotta", variant: "main", seed: 82 },
  { id: "article-04", palette: "ocean", variant: "alt", seed: 104 },
  { id: "article-05", palette: "rose", variant: "main", seed: 119 },
  { id: "collection-01", palette: "navy", variant: "main", seed: 131 },
  { id: "collection-02", palette: "forest", variant: "alt", seed: 144 },
  { id: "collection-03", palette: "terracotta", variant: "main", seed: 158 },
];

for (const cover of covers) {
  writeFileSync(
    `${OUT}/${cover.id}.svg`,
    coverSvg({ width: 1600, height: 1000, seed: cover.seed, palette: cover.palette, id: cover.id, variant: cover.variant }),
  );
}

writeFileSync(`${OUT}/avatar.svg`, avatarSvg());

console.log(`Generated ${artworks.length + covers.length + 1} demo assets in ${OUT}`);
