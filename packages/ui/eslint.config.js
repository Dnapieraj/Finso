// @ts-check
import { reactConfig } from "@vireo/config/eslint/react";

export default [
  ...reactConfig,
  {
    // Tests and scripts are type-checked by tsconfig.node.json (Node
    // globals), which the project service would not find on its own.
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
