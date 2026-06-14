import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'X-Reply Copilot',
    description: 'Local vision-LLM reply co-pilot for X/Twitter',
    permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
    host_permissions: [
      'https://x.com/*',
      'https://twitter.com/*',
      'http://localhost:11434/*',
    ],
    action: {},
  },
});
