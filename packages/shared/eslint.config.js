// @ts-check
import { baseConfig } from "@vireo/config/eslint/base";

export default [
  ...baseConfig,
  {
    // The budget engine works on grosze only; turning amounts into display
    // text is the presentation layer's job, even though both live here.
    files: ["src/budget/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^|/)format(/|$)",
              message:
                "budget/ is pure calculation: format amounts in the presentation layer (web, mobile), not in the engine.",
            },
          ],
        },
      ],
    },
  },
];
