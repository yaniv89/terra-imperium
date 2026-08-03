module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'docs', 'node_modules'],
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    // Off rather than 'warn': context/provider files legitimately co-export hooks (useGame)
    // and non-component values alongside the provider component — that's a normal pattern,
    // not a bug, and this rule only affects Fast Refresh DX, not correctness.
    'react-refresh/only-export-components': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
};
