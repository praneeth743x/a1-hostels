"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { rpcCall } from '@/lib/rpc';
import { useHostel } from '@/context/HostelContext';
import { SplashScreen } from '@/components/SplashScreen';
import { isTrueColdLaunch, markSessionStarted } from '@/lib/launchDetector';
import { getPlatform, PlatformType } from '@/lib/platform';
import AppLogin from '@/components/AppLogin';

export default function MobileLoginPage() {
  const router = useRouter();

  const [platform, setPlatform] = useState<PlatformType>('PWA');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    const p = getPlatform();
    if (p === 'WEB_BROWSER') {
      router.replace('/login');
      return;
    }
    setPlatform(p);
  }, [router]);

  // PWA Cold-Launch Detection
  const [showSplash] = useState<boolean>(() => {
    const coldLaunch = isTrueColdLaunch();
    markSessionStarted();
    return coldLaunch;
  });

  const [redirectFired, setRedirectFired] = useState(false);
  const splashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showSplash) {
      splashTimeoutRef.current = setTimeout(() => {
        setRedirectFired(true);
      }, 0);
    }
    return () => {
      if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
    };
  }, [showSplash]);

  const { currentUser, authStatus, isLoadingAuth } = useHostel();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [siteName, setSiteName] = useState('A1 Hostels');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    rpcCall('getLandingSettings').then(res => {
      if (res?.success && res?.data) {
        if (res.data.siteName) setSiteName(res.data.siteName);
        if (res.data.logoUrl) setLogoUrl(res.data.logoUrl);
      }
    });
  }, []);

  // Forgot Password Modal
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState<string | null>(null);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const isExplicitLoggedOut = sessionStorage.getItem('loggedOut') === 'true';
      const cachedRole = localStorage.getItem('userRole');

      if (isExplicitLoggedOut) {
        return;
      }

      if (isLoggedIn && cachedRole) {
        const target = cachedRole === 'super_admin' ? '/superadmin/owners' : (cachedRole === 'team_member' || cachedRole === 'pg_owner') ? '/pgowner' : '/tenant';
        router.replace(target);
      }
    }
  }, [router]);

  const routingInProgressRef = useRef(false);

  useEffect(() => {
    if (authStatus === 'READY' && currentUser) {
      const isExplicitLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('loggedOut') === 'true';

      if (currentUser.email && (!isExplicitLoggedOut || loading)) {
        if (routingInProgressRef.current) return;
        sessionStorage.removeItem('loggedOut');
        setRedirectFired(true);
        routeUser(currentUser.uid, currentUser.email);
      } else {
        setRedirectFired(true);
      }
    } else if (authStatus === 'UNAUTHENTICATED') {
      setRedirectFired(true);
    }
  }, [currentUser, authStatus, router, loading]);

  const routeUser = async (userId: string | undefined, userEmail: string, forcedRole?: string) => {
    if (!userId) return;

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('loggedOut');
    }

    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', deviceId);
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const deviceName = isMobile ? 'Mobile App' : 'Web Browser';

    await rpcCall('registerDevice', userId, deviceId, deviceName).catch((e) => console.error("Device registration error:", e));

    try {
      let roleStr = forcedRole;
      if (!roleStr) {
        const fetchedRole = await rpcCall('getResolvedRole', userId, userEmail);

        if (fetchedRole && typeof fetchedRole === 'string') {
          roleStr = fetchedRole;
        } else if (fetchedRole && typeof fetchedRole === 'object' && !fetchedRole.error) {
          roleStr = fetchedRole.role;
        }
      }

      if (!roleStr) {
        const meta = await rpcCall('getLoginAuthMeta', userId, userEmail);
        if (meta?.role) {
          roleStr = meta.role;
        }
      }

      const finalRole = roleStr || 'pg_owner';
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userUid', userId);
      localStorage.setItem('userRole', finalRole);

      const target = finalRole === 'super_admin' ? '/superadmin/owners' : finalRole === 'team_member' ? '/teammember/dashboard' : finalRole === 'tenant' ? '/tenant' : '/pgowner/dashboard';
      
      try {
        router.replace(target);
      } catch (e) {
        window.location.href = target;
      }
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname === '/moblogin') {
          window.location.href = target;
        }
      }, 200);
    } catch (e: any) {
      console.error("Failed to fetch role:", e);
      setError(e.message || "Failed to resolve user role.");
      setLoading(false);
      await signOut(auth).catch(() => {});
    }
  };

  const handleGoogleSignIn = async () => {
    routingInProgressRef.current = true;
    setLoading(true);
    setError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('loggedOut');
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const isCapacitor = typeof window !== 'undefined' && Boolean((window as any).Capacitor || (window as any).isNativeApp);
      let user: any = null;
      
      if (isCapacitor) {
        // Native Google Sign-In using Capacitor plugin
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const { signInWithCredential } = await import('firebase/auth');
        
        const nativeResult = await FirebaseAuthentication.signInWithGoogle();
        const idToken = nativeResult.credential?.idToken;
        
        if (!idToken) throw new Error("Failed to retrieve Google credential token.");
        
        const credential = GoogleAuthProvider.credential(idToken);
        const webResult = await signInWithCredential(auth, credential);
        user = webResult.user;
      } else {
        try {
          const result = await signInWithPopup(auth, provider);
          user = result.user;
        } catch (popupErr: any) {
          if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/cancelled-popup-request') {
            console.log("Popup blocked on mobile/iOS Safari, switching to redirect...");
            await signInWithRedirect(auth, provider);
            return;
          }
          throw popupErr;
        }
      }

      if (!user?.email) throw new Error("Google account must have an email.");

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('loggedOut');
      }

      const meta = await rpcCall('getLoginAuthMeta', user.uid, user.email);
      if (!meta?.exists) {
        await signOut(auth);
        throw new Error("This email is not registered. Please ask your PG Owner to add you.");
      }

      if (!meta?.isInitialized) {
        await rpcCall('markAccountInitialized', user.email).catch(() => {});
      }

      await routeUser(user.uid, user.email, meta.role);

    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log("Google sign in popup closed by user.");
      } else {
        console.error("Google sign in error:", err);
        setError(err?.message || "Failed to sign in with Google.");
      }
    } finally {
      routingInProgressRef.current = false;
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    routingInProgressRef.current = true;
    setLoading(true);
    setError(null);
    try {
      let targetEmail = email.trim();
      if (!targetEmail.includes('@')) {
        const res = await rpcCall('getTenantEmailByPhone', targetEmail);
        if (!res?.success || !res?.email) {
          throw new Error(res?.error || "No account found with this phone number.");
        }
        targetEmail = res.email;
      }

      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      const meta = await rpcCall('getLoginAuthMeta', userCredential.user.uid, targetEmail);

      if (meta?.isSuspended || !meta?.exists) {
        await signOut(auth);
        throw new Error("Invalid credentials.");
      }

      if (!meta?.isInitialized) {
        router.push(`/tenant/setup-password?email=${encodeURIComponent(targetEmail)}`);
        return;
      }

      await routeUser(userCredential.user.uid, targetEmail, meta.role);
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      routingInProgressRef.current = false;
      setLoading(false);
    }
  };

  const maskEmail = (email: string) => {
    const [user, domain] = email.split('@');
    if (!user || !domain) return email;
    return `${user[0]}***@${domain}`;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordMsg(null);
    try {
      const input = forgotPasswordEmail.trim();
      let targetEmail = input;

      if (!input.includes('@')) {
        const res = await rpcCall('getTenantEmailByPhone', input);
        if (!res?.success || !res?.email) {
          throw new Error(res?.error || "No account found with this phone number.");
        }
        targetEmail = res.email;
      }

      const exists = await rpcCall('checkUserByEmail', targetEmail);
      if (!exists) {
        throw new Error("This email is not registered.");
      }
      
      const { sendPasswordResetAction } = await import('@/app/actions/tenant');
      const res = await sendPasswordResetAction(targetEmail, window.location.origin);
      if (!res.success) {
        throw new Error(res.error || "Failed to send password reset email.");
      }
      
      setForgotPasswordMsg(`Password reset email sent to ${maskEmail(targetEmail)}! Please check your inbox.`);
    } catch (err: any) {
      setForgotPasswordMsg(err.message || "Failed to send reset email.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  if (!loading && (showSplash && !redirectFired)) {
    return <SplashScreen />;
  }

  return (
    <AppLogin
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      loading={loading}
      error={error}
      onSubmit={handleEmailLogin}
      onGoogleSignIn={handleGoogleSignIn}
      logoUrl={logoUrl}
      siteName={siteName}
      showForgotPasswordModal={showForgotPasswordModal}
      setShowForgotPasswordModal={setShowForgotPasswordModal}
      forgotPasswordEmail={forgotPasswordEmail}
      setForgotPasswordEmail={setForgotPasswordEmail}
      forgotPasswordMsg={forgotPasswordMsg}
      setForgotPasswordMsg={setForgotPasswordMsg}
      forgotPasswordLoading={forgotPasswordLoading}
      onForgotPasswordSubmit={handleForgotPassword}
    />
  );
}
