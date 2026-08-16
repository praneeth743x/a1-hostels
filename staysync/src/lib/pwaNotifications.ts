"use client";

/**
 * PWA Mobile Notification Utility
 * Handles browser & mobile device notification bar alerts for PG Owners.
 */

const notifiedCache = new Set<string>();

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    // Register Service Worker if not registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW registration warning:', err));
    }

    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
  }
  return false;
}

export async function triggerPWANotification(id: string, title: string, body: string, tag?: string, url?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  // Prevent duplicate alerts
  if (notifiedCache.has(id)) {
    return;
  }
  notifiedCache.add(id);

  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.warn('Notification permission not granted');
      return;
    }
  }

  try {
    const options: NotificationOptions = {
      body,
      icon: '/himalaya_logo_premium.png',
      badge: '/himalaya_logo_premium.png',
      tag: tag || id,
      data: { url: url || '/pgowner' }
    };

    // Race serviceWorker.ready with a 500ms timeout to prevent hanging in dev mode
    let swSuccess = false;
    if ('serviceWorker' in navigator) {
      try {
        const swPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 500));
        const registration: any = await Promise.race([swPromise, timeoutPromise]);
        
        if (registration && registration.showNotification) {
          await registration.showNotification(title, options);
          swSuccess = true;
        }
      } catch (swErr) {
        console.warn('Service Worker notification error:', swErr);
      }
    }

    // Direct Browser Notification fallback if Service Worker was not ready
    if (!swSuccess && 'Notification' in window) {
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        if (url) window.location.href = url;
      };
    }
  } catch (err) {
    console.warn('Error triggering PWA notification:', err);
  }
}
