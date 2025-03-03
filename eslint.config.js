import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    name: "your-project/all-rules",
    files: ["**/*.js"],
    // rules: {
    //   // ...pluginJs.configs.all.rules,
    //   "id-length": "off",
    //   "max-statements": "off",
    //   "max-lines-per-function": "off",
    //   "no-unused-vars": "warn",
    //   "no-console": "off",
    //   "sort-vars": "off",
    //   "sort-keys": "off",
    //   "sort-imports": "off",
    // },
  },
];
