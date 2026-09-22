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
  // android/ios: Capacitor's native platform projects — `npx cap sync` copies the built web
  // bundle (minified, not source) into android/app/src/main/assets/public and
  // ios/App/App/public, which ESLint would otherwise choke on. www: the mobile build's own
  // output directory (npm run build:mobile), same reasoning as dist/docs for the web build.
  // supabase/functions/**/_engine.bundle.js: the Supabase Edge Function's bundled engine (npm run
  // build:edge) — a build artifact, not source, same reasoning again.
  ignorePatterns: ['dist', 'docs', 'node_modules', 'android', 'ios', 'www', 'supabase/functions/**/_engine.bundle.js'],
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
