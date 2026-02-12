import { defineConfig } from 'wxt';
import pkg from './package.json';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  vite: () => ({
    /*
    ssr: {
      noExternal: [
        'tesseract.js',
        'tesseract.js-core',
        '@tesseract.js-data',
      ],
    },
    */
    optimizeDeps: {
      exclude: [
        //'tesseract.js',
        //'tesseract.js-core',
        '@tesseract.js-data',
      ],
    }
  }),
  manifest: {
    name: pkg.name,
    version: pkg.version,
    icons: {
      48: 'logo.png',
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
