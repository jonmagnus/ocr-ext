import { defineConfig } from 'wxt';
import pkg from './package.json';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  vite: () => ({
    build: {
      target: 'esnext',
    },
  }),
  manifest: {
    name: pkg.name,
    version: pkg.version,
    icons: {
      48: 'logo.png',
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    commands: {
      select: {
        suggested_key: { default: 'Alt+A' },
        description: 'Select rectangle for screenshot',
      },
    },
    permissions: [
      'offscreen',
      'scripting',
      'commands',
      'activeTab',
      'contentSettings',
    ],
  }
});
