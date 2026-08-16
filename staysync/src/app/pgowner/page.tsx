"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHostel } from '@/context/HostelContext';

/**
 * PGOwner index redirect.
 *
 * HostelContext has already initialized from cache (authStatus = 'READY'
 * immediately after onAuthStateChanged fires). We simply read the cached
 * hostel state and redirect — no duplicate auth subscription needed.
 */
export default function PGOwnerRedirect() {
  const router = useRouter();
  const { authStatus, selectedPgId } = useHostel();

  useEffect(() => {
    const hasLocalSession = typeof window !== 'undefined' && (!!localStorage.getItem('userUid') || localStorage.getItem('isLoggedIn') === 'true');
    const isExplicitLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('loggedOut') === 'true';

    if (isExplicitLoggedOut) {
      router.replace('/login');
      return;
    }

    if (authStatus === 'UNAUTHENTICATED' && !hasLocalSession) {
      router.replace('/login');
      return;
    }

    // Default redirect for authenticated users
    router.replace('/pgowner/dashboard');
  }, [authStatus, selectedPgId, router]);

  // Render nothing — the redirect fires as soon as auth resolves.
  return null;
}

