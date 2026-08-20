export type PlatformType = 'WEB_BROWSER' | 'PWA' | 'ANDROID_APP';

/**
 * Robustly detects whether the application is running as a normal web browser,
 * an installed PWA, or inside the native Android WebView (Capacitor or similar).
 */
export function getPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'WEB_BROWSER';

  // 1. Android Packaged App / WebView Capacitor Detection
  const isCapacitor = 
    (window as any).Capacitor || 
    (window.parent && (window.parent as any).Capacitor) || 
    (typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Capacitor'));
    
  const isAndroidWebView = 
    (typeof document !== 'undefined' && document.referrer.includes('android-app://')) ||
    (typeof navigator !== 'undefined' && 
      (navigator.userAgent || '').toLowerCase().includes('android') && 
      (navigator.userAgent || '').toLowerCase().includes('wv'));

  if (isCapacitor || isAndroidWebView) {
    return 'ANDROID_APP';
  }

  // 2. Installed PWA / Standalone Mode Detection
  const isPwaStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as any).standalone === true; // iOS Safari PWA fallback

  if (isPwaStandalone) {
    return 'PWA';
  }

  // 3. Normal Browser (Desktop or Mobile)
  return 'WEB_BROWSER';
}
