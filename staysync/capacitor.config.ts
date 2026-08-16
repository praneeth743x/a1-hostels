import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.staysync.app',
  appName: 'StaySync',
  webDir: 'public',
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://YOUR_NEW_APP.web.app',
    cleartext: true,
    allowNavigation: [
      "*.firebaseapp.com",
      "accounts.google.com",
      "*.googleapis.com"
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      launchAutoHide: true,
      backgroundColor: "#4F46E5",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
