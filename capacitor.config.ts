import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agesofwar.app',
  appName: 'Ages of War',
  webDir: 'dist',
  plugins: {
    SplashScreen: { launchShowDuration: 3000 },
    StatusBar: { style: 'dark', backgroundColor: '#000000' },
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
  },
  android: { backgroundColor: '#000000' },
  ios: { contentInset: 'always' },
};

export default config;
