import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.staysync.app',
  appName: 'StaySync',
  webDir: 'public',
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://YOUR_NEW_APP.web.app',
    cleartext: true
  }
};

export default config;
