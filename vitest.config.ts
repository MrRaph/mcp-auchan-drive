import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // index.ts est le point d'entrée MCP (stdio) — non testable unitairement sans démarrer le serveur
      exclude: ['src/index.ts'],
      thresholds: {
        statements: 80,
        // Les branches win32/linux dans firefoxDir() et le parsing profiles.ini
        // ne sont pas testables sur macOS — seuil ajusté en conséquence.
        branches: 64,
        functions: 80,
        lines: 80,
      },
    },
  },
});
