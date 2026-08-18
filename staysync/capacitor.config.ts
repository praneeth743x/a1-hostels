import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.a1hostels.app',
  appName: 'A1 Hostels',
  webDir: 'public',
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://a1-hostels.web.app',
    cleartext: true,
    allowNavigation: [
      "*.firebaseapp.com",
      "accounts.google.com",
      "*.googleapis.com",
      "*.google.com",
      "*.gstatic.com"
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
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"]
    }
  }
};

export default config;
