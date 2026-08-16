/**
 * Launch Detector — determines when the custom loading screen is permitted.
 *
 * Rules:
 *  - Browser (any): NEVER show loading screen
 *  - PWA cold launch (first open after close): SHOW loading screen ONCE
 *  - PWA reload / soft navigation / hostel switch: NEVER show loading screen
 *
 * Detection strategy:
 *  isPWA()          → navigator.standalone OR display-mode: standalone
 *  isTrueColdLaunch() → isPWA() AND sessionStorage flag is absent
 *
 * sessionStorage is ideal because:
 *  - It survives soft navigations within the same app session (correct)
 *  - It is cleared when the app is fully closed and reopened (correct)
 *  - It is cleared on browser reload in Chrome/Android (correct — we don't
 *    want splash on reload, and the isPWA() check also prevents it in browser)
 *
 * NOTE: All functions are safe to call on the server (SSR) — they return
 * false when window is not available.
 */

const SESSION_KEY = 'raliving_session_started';

/**
 * Returns true if the app is running as an installed PWA (standalone mode).
 * Returns false in any browser tab (Chrome, Edge, Firefox, Safari).
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS Safari installed PWA
  if ((navigator as any).standalone === true) return true;

  // Android / Chrome / Edge installed PWA
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  } catch (_) {
    // matchMedia not supported — treat as browser
  }

  return false;
}

/**
 * Returns true ONLY when:
 *   1. The app is running as an installed PWA, AND
 *   2. No session flag exists (meaning this is a fresh app launch, not a reload
 *      or an internal navigation).
 *
 * This is the single gate for displaying the custom loading screen.
 */
export function isTrueColdLaunch(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isPWA()) return false;

  try {
    const alreadyStarted = sessionStorage.getItem(SESSION_KEY);
    return alreadyStarted === null;
  } catch (_) {
    // sessionStorage blocked (private browsing edge case)
    return false;
  }
}

/**
 * Call this immediately after reading isTrueColdLaunch().
 * Sets the session flag so subsequent navigations and reloads within this
 * session are not treated as cold launches.
 */
export function markSessionStarted(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch (_) {
    // sessionStorage blocked — silently ignore
  }
}
