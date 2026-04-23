import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      react: { version: '19' }, // Avoids auto-detection crash
    },
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'info', 'error'] }],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
          enableAutofixRemoval: { imports: true },
        },
      ],
    },
  },
  {
    // Enforce package boundary: the CMS package (src/) must not import from the consumer (demo/).
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/demo/**', 'bananacms-demo', 'bananacms-demo/*'],
              message:
                'CMS source must not depend on the consumer (demo). Keep the package boundary one-way.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['.next/', 'dist/', 'src/.next/', 'demo/.next/'],
  },
  prettierRecommended,
]

export default eslintConfig
