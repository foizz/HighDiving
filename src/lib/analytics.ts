import { useSyncExternalStore } from 'react';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const STORAGE_KEY = 'hd.consent';
// Bump when the privacy policy changes materially, so everyone is asked again.
const CONSENT_VERSION = 1;

type Consent = { analytics: boolean; timestamp: string; version: number };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean;
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

export const analyticsConfigured = Boolean(MEASUREMENT_ID);

function read(): Consent | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Consent | null;
    return parsed?.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

let consent = read();
const listeners = new Set<() => void>();

/** A Global Privacy Control signal counts as a standing "no", so we never ask. */
function gpc(): boolean {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
}

/** null means the visitor hasn't chosen yet and should be asked. */
export function getAnalyticsConsent(): boolean | null {
  if (!analyticsConfigured || gpc()) return false;
  return consent ? consent.analytics : null;
}

export function setAnalyticsConsent(allowed: boolean): void {
  consent = { analytics: allowed, timestamp: new Date().toISOString(), version: CONSENT_VERSION };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Storage blocked: the choice still holds for this visit.
  }
  if (allowed) startAnalytics();
  else stopAnalytics();
  listeners.forEach((l) => l());
}

export function useAnalyticsConsent(): boolean | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getAnalyticsConsent,
  );
}

let loaded = false;

function startAnalytics(): void {
  if (!MEASUREMENT_ID || getAnalyticsConsent() !== true) return;
  window[`ga-disable-${MEASUREMENT_ID}`] = false;
  if (loaded) return;
  loaded = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js reads the arguments object, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

function stopAnalytics(): void {
  if (!MEASUREMENT_ID) return;
  window[`ga-disable-${MEASUREMENT_ID}`] = true;
  const host = location.hostname;
  for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim())) {
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of ['', `; domain=${host}`, `; domain=.${host.split('.').slice(-2).join('.')}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  }
}

/** Runs once on startup: picks up a choice made on an earlier visit. */
export function initAnalytics(): void {
  startAnalytics();
}

export function trackPageView(path: string): void {
  if (!loaded || getAnalyticsConsent() !== true || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: location.origin + path,
    page_title: document.title,
  });
}
