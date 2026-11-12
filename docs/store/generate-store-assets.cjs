// Store graphics for Google Play from raw app screenshots (1080×2400, taken
// with Maestro on the emulator, see docs/SKLEPY.md):
//   node docs/store/generate-store-assets.cjs <path to sharp> <screenshots dir>
// where <path to sharp> is node_modules/.pnpm/sharp@<version>/node_modules/sharp.
// Writes docs/store/google-play/*.png: 1080×1920 screenshots with a caption
// (Play wants at most 2:1, raw ones are 2.22:1) and the 1024×500 feature graphic.
const path = require("path");
const sharp = require(path.resolve(process.argv[2]));
const shots = path.resolve(process.argv[3]);
const out = path.join(__dirname, "google-play");

const OLIVE = "#3D5A2E";
const CREAM = "#F5F8EF";
const FONT = "Segoe UI, Arial, sans-serif";

const SCREENS = [
  ["01-start", "Ile możesz dziś wydać", "od razu, bez liczenia"],
  ["02-symulator", "Czy mnie stać?", "sprawdź przed zakupem"],
  ["03-cele", "Cele, które same", "liczą ratę na okres"],
  ["04-wplaty", "Wpłaty na cel", "z historią i „Cofnij”"],
  ["05-historia", "Historia od wypłaty", "do wypłaty"],
  ["06-subskrypcje", "Wszystkie subskrypcje", "w jednym miejscu"],
];

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function caption(width, lines, y, size) {
  return lines
    .map(
      (line, index) =>
        `<text x="${width / 2}" y="${y + index * size * 1.25}" text-anchor="middle"
           font-family="${FONT}" font-size="${size}" font-weight="700" fill="${CREAM}">${escape(line)}</text>`,
    )
    .join("");
}

const leaf = `
  <path d="M300 760 C 270 500, 440 290, 780 250 C 760 590, 560 790, 300 760 Z" fill="${CREAM}"/>
  <path d="M340 720 L 236 824" stroke="${CREAM}" stroke-width="56" stroke-linecap="round"/>
  <path d="M405 545 L 500 640 L 668 430" fill="none" stroke="${OLIVE}" stroke-width="66"
        stroke-linecap="round" stroke-linejoin="round"/>`;

(async () => {
  require("fs").mkdirSync(out, { recursive: true });
  const W = 1080;
  const H = 1920;
  const shotH = 1560;
  const shotW = Math.round((1080 * shotH) / 2400);
  const radius = 48;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${shotW}" height="${shotH}"><rect width="${shotW}" height="${shotH}" rx="${radius}" fill="#fff"/></svg>`,
  );

  for (const [name, first, second] of SCREENS) {
    const shot = await sharp(path.join(shots, `${name}.png`))
      .resize(shotW, shotH)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const background = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
         <rect width="${W}" height="${H}" fill="${OLIVE}"/>
         ${caption(W, [first, second], 150, 68)}
       </svg>`,
    );
    await sharp(background)
      .composite([{ input: shot, left: Math.round((W - shotW) / 2), top: H - shotH - 60 }])
      .removeAlpha()
      .png()
      .toFile(path.join(out, `${name}.png`));
    console.log("wrote", name);
  }

  const feature = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
       <rect width="1024" height="500" fill="${OLIVE}"/>
       <g transform="translate(70 70) scale(0.36)">${leaf}</g>
       <text x="440" y="225" font-family="${FONT}" font-size="96" font-weight="700" fill="${CREAM}">Finso</text>
       <text x="440" y="300" font-family="${FONT}" font-size="40" fill="${CREAM}">Czy stać mnie na to teraz?</text>
     </svg>`,
  );
  await sharp(feature).removeAlpha().png().toFile(path.join(out, "feature-graphic.png"));
  console.log("wrote feature-graphic");
})();
