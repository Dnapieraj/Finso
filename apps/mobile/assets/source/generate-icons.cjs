// Generates Finso app icons and splash from one leaf-with-a-check mark.
// Usage (sharp comes with Expo, it is not a direct dependency):
//   node apps/mobile/assets/source/generate-icons.cjs <path to sharp> apps/mobile/assets
//   where <path to sharp> is node_modules/.pnpm/sharp@<version>/node_modules/sharp
// Writes icon-512.png, apple-icon.png and icon.svg next to this script for the website
// (copy icon.svg and apple-icon.png to apps/web/src/app).
const path = require("path");
const sharp = require(path.resolve(process.argv[2]));
const out = path.resolve(process.argv[3]);

const OLIVE = "#3D5A2E";
const CREAM = "#F5F8EF";

// The mark in a 1024 box, centred: a leaf tilted up-right, its vein a check.
const leaf = (fill, check) => `
  <path d="M300 760 C 270 500, 440 290, 780 250 C 760 590, 560 790, 300 760 Z" fill="${fill}"/>
  <path d="M340 720 L 236 824" stroke="${fill}" stroke-width="56" stroke-linecap="round"/>
  <path d="M405 545 L 500 640 L 668 430" fill="none" stroke="${check}" stroke-width="66"
        stroke-linecap="round" stroke-linejoin="round"/>`;

/** The mark scaled around the centre: `scale` 1 = full 1024 box. */
const mark = (scale, fill, check) =>
  `<g transform="translate(512 512) scale(${scale}) translate(-508 -537)">${leaf(fill, check)}</g>`;

const svg = (body, background) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ""}
  ${body}
</svg>`;

// Monochrome (Android 13 themed icons): the check is cut out of the leaf.
const monochrome = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><mask id="m"><rect width="1024" height="1024" fill="white"/>
    ${mark(0.72, "white", "black").replace('fill="white"/>', 'fill="white"/>')}
  </mask></defs>
  <g mask="url(#m)">${mark(0.72, "white", "white")}</g>
</svg>`;

// Splash: an olive disc with the cream leaf — reads on light and dark backgrounds alike.
const splash = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <circle cx="512" cy="512" r="500" fill="${OLIVE}"/>
  ${mark(0.78, CREAM, OLIVE)}
</svg>`;

const files = {
  // iOS and the store listing: full bleed, no transparency.
  "icon.png": svg(mark(0.86, CREAM, OLIVE), OLIVE),
  // Android adaptive icon: the launcher masks to a circle or squircle and only
  // the middle ~61% is always visible, so the mark stays inside it.
  "android-icon-foreground.png": svg(mark(0.72, CREAM, OLIVE), null),
  "android-icon-background.png": svg("", OLIVE),
  "android-icon-monochrome.png": monochrome,
  "splash-icon.png": splash,
};

(async () => {
  for (const [name, source] of Object.entries(files)) {
    // App Store rejects an icon with an alpha channel; opaque files drop it.
    const image = sharp(Buffer.from(source));
    const opaque = name === "icon.png" || name === "android-icon-background.png";
    await (opaque ? image.removeAlpha() : image).png().toFile(path.join(out, name));
    console.log("wrote", name);
  }
  // Web favicon sizes, written next to the script for the web step.
  await sharp(Buffer.from(files["icon.png"]))
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, "icon-512.png"));
  await sharp(Buffer.from(files["icon.png"]))
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, "apple-icon.png"));
  require("fs").writeFileSync(path.join(__dirname, "icon.svg"), files["icon.png"]);
})();
