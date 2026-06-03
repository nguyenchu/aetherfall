import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor pakker web-byggen (dist/) inn i native iOS/Android-skall.
// Samme kodebase som nettleseren — ingen omskriving.
const config: CapacitorConfig = {
  appId: 'com.nguyenchu.aetherfall',
  appName: 'Aetherfall',
  webDir: 'dist',
  backgroundColor: '#07060e',
};

export default config;
