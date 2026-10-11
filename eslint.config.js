// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/'] },
  eslint.configs.recommended,
  // Type-aware rules: catch floating promises, unsafe `any`, misused async, etc.
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Config files at the repo root are plain JS, outside tsconfig
  { files: ['*.js'], extends: [tseslint.configs.disableTypeChecked] },
  // Must be last: turns off rules that conflict with Prettier
  prettier,
);
