import { defineConfig } from 'vitest/config'
import path from 'node:path'

// The test runner, bootstrapped by ticket 090 (spec 083, Testing Decisions).
//
// Deliberately NOT merged into `vite.config.ts`: the app config carries a build
// stamp that shells out to git and a dev proxy, neither of which a pure unit run
// needs. Vitest prefers this file when it exists, so the two stay independent.
//
// Scope is `environment: 'node'` and `*.test.ts` only — no jsdom, no React
// Testing Library (spec 083: the pure modules are where regression is silent;
// the components are thin renderers verified by driving the app). The `@` alias
// is repeated here because this config does not read `vite.config.ts`.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
