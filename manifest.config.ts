import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  background: {
    service_worker: 'src/service-worker.ts',
    type: 'module',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [{
    js: ['src/content/main.ts'],
    matches: ['https://*/*'],
  }],
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
    'sidePanel',
    'contentSettings',
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  web_accessible_resources: [
    {
      resources: [
      ],
      matches: ['<all_urls>'],
    },
  ],
})
