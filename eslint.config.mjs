import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'backups/**', 'reports/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'], plugins: { 'react-hooks': hooks }, rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  } },
);
