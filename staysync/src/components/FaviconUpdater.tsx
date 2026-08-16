"use client";

import { useEffect } from 'react';
import { rpcCall } from '@/lib/rpc';

export function FaviconUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyFavicon = (url: string) => {
      if (!url) return;
      
      const iconLinks = document.querySelectorAll("link[rel~='icon']");
      if (iconLinks.length === 0) {
        const newIcon = document.createElement('link');
        newIcon.rel = 'icon';
        newIcon.href = url;
        document.head.appendChild(newIcon);
      } else {
        iconLinks.forEach(link => {
          (link as HTMLLinkElement).href = url;
        });
      }

      const appleLinks = document.querySelectorAll("link[rel~='apple-touch-icon']");
      appleLinks.forEach(link => {
        (link as HTMLLinkElement).href = url;
      });
    };

    // 1. Immediately apply cached logo if available
    const cachedLogo = localStorage.getItem('cachedLogoUrl');
    if (cachedLogo) {
      applyFavicon(cachedLogo);
    }

    // 2. Fetch landing settings safely via RPC action
    rpcCall('getLandingSettings').then((res) => {
      if (res?.success && res?.data?.logoUrl) {
        const logoUrl = res.data.logoUrl;
        localStorage.setItem('cachedLogoUrl', logoUrl);
        applyFavicon(logoUrl);
      }
    }).catch(() => {});
  }, []);

  return null;
}
