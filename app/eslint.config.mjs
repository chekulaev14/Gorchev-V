import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // F7.2: запрет импорта из data/ + кросс-модульных импортов
  {
    files: ["src/components/terminal/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/data/*", "*/data/*"], message: "Компоненты не должны импортировать из data/. Используйте API." },
          { group: ["@/components/warehouse/*", "*/components/warehouse/*"], message: "terminal не должен импортировать из warehouse. Используйте shared-слой (lib/, ui/)." },
        ],
      }],
    },
  },
  {
    files: ["src/components/warehouse/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/data/*", "*/data/*"], message: "Компоненты не должны импортировать из data/. Используйте API." },
          { group: ["@/components/terminal/*", "*/components/terminal/*"], message: "warehouse не должен импортировать из terminal. Используйте shared-слой (lib/, ui/)." },
        ],
      }],
    },
  },
  // F7.2: предупреждение при >300 строк в функции
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-lines-per-function": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
]);

export default eslintConfig;
