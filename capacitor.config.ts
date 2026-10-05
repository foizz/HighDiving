import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mitradev.highdiving',
  appName: 'High Dive List',
  webDir: 'dist',
  backgroundColor: '#060e26',
  ios: {
    // The page handles the safe areas itself (see .pt-safe / .pb-safe in index.css).
    contentInset: 'never',
    backgroundColor: '#060e26',
  },
};

export default config;
