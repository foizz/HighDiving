import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** True when running inside the iOS app shell rather than a browser. */
export const isNative = Capacitor.isNativePlatform();

/**
 * Match the native status bar text to the page palette: light text on the dark Red Bull
 * skin, dark text on the light World Aquatics one. A no-op in the browser.
 */
export function syncStatusBar(palette: 'dark' | 'light'): void {
  if (!isNative) return;
  StatusBar.setStyle({ style: palette === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
}
