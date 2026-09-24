import { writeFileSync } from "node:fs";

import { theme, themeToCss } from "@vireo/tokens";

// Node runs this file directly (type stripping, Node >= 22.18), so there is
// no build step between editing tokens and regenerating the stylesheet.
const target = new URL("../src/styles/theme.css", import.meta.url);
writeFileSync(target, themeToCss(theme));
console.log(`Wrote ${target.pathname}`);
