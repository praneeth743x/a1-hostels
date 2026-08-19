"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, Search, X, ShieldCheck, ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { rpcCall } from '@/lib/rpc';
import InstallPWAButton from '@/components/InstallPWAButton';
import { useHostel } from '@/context/HostelContext';
import { SplashScreen } from '@/components/SplashScreen';
import { isTrueColdLaunch, markSessionStarted } from '@/lib/launchDetector';
import styles from './login.module.css';
import { getPlatform, PlatformType } from '@/lib/platform';
import AppLogin from '@/components/AppLogin';

export default function LoginPage() {
  const router = useRouter();

  const [isStandalonePwa, setIsStandalonePwa] = useState(false);
  const [platform, setPlatform] = useState<PlatformType>('WEB_BROWSER');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    const p = getPlatform();
    setPlatform(p);
    setIsStandalonePwa(p !== 'WEB_BROWSER');
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam === 'account_disabled') {
        setError("Your account has been disabled. Please contact support.");
      }
      const redirectErr = sessionStorage.getItem('redirect_login_error');
      if (redirectErr) {
        setError(redirectErr);
        sessionStorage.removeItem('redirect_login_error');
      }
    }
  }, []);

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
      }, 0); // Reduced to 0 for instant loading
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
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

  // Redirect result is handled globally by HostelContext.
  // Login page only handles the auth status changes via the useEffect below.

  const routingInProgressRef = useRef(false);

  useEffect(() => {
    if (authStatus === 'READY' && currentUser) {
      const isExplicitLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('loggedOut') === 'true';

      if (currentUser.email && (!isExplicitLoggedOut || loading)) {
        // Skip if a sign-in handler (handleGoogleSignIn/handleEmailLogin) is already routing
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

    // Await device registration to ensure it exists in Firestore before page redirect
    await rpcCall('registerDevice', userId, deviceId, deviceName).catch((e) => console.error("Device registration error:", e));

    try {
      let roleStr = forcedRole;
      if (!roleStr) {
        const fetchedRole = await rpcCall('getResolvedRole', userId, userEmail);

        if (!fetchedRole || (typeof fetchedRole === 'object' && fetchedRole.error)) {
          throw new Error((typeof fetchedRole === 'object' && fetchedRole.error) || "Role not found. Please contact support.");
        }

        roleStr = typeof fetchedRole === 'string' ? fetchedRole : fetchedRole.role;
      }

      const finalRole = roleStr || 'tenant';
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userUid', userId);
      localStorage.setItem('userRole', finalRole);

      const target = finalRole === 'super_admin' ? '/superadmin/owners' : finalRole === 'team_member' ? '/teammember/dashboard' : finalRole === 'pg_owner' ? '/pgowner/dashboard' : '/tenant';
      
      try {
        router.replace(target);
      } catch (e) {
        window.location.href = target;
      }
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname === '/login') {
          window.location.href = target;
        }
      }, 300);
    } catch (e: any) {
      console.error("Failed to fetch role:", e);
      setError(e.message || "Failed to resolve user role.");
      setLoading(false);
      // Reset auth state on failure so we don't get stuck in splash screen loop
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
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
      const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform();
      
      let user;
      
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
      } else if (isMobile || isStandalone || (typeof navigator !== 'undefined' && (navigator.userAgent || '').toLowerCase().includes('wv'))) {
        // Mobile/WebView environments: Use Redirect to avoid popup blockers and disallowed_useragent errors
        await signInWithRedirect(auth, provider);
        return; // Execution stops here as browser redirects
      } else {
        // Desktop environments: Use Popup for better UX
        const result = await signInWithPopup(auth, provider);
        user = result.user;
      }

      if (!user.email) throw new Error("Google account must have an email.");

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
        // Treat as phone number
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

  if (isLoadingAuth || (showSplash && !redirectFired) || (authStatus === 'READY' && currentUser)) {
    return <SplashScreen />;
  }

  if (platform === 'PWA' || platform === 'ANDROID_APP') {
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

  return (
    <div className={styles.loginPageContainer}>
      {/* ==================== LEFT — Hero Panel (Desktop Only) ==================== */}
      <div className={styles.heroPanel}>
        <img 
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80" 
          alt="Premium Hostel" 
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Welcome Back</h1>
          <p className={styles.heroSubtitle}>Manage your properties, track payments, and keep everything running smoothly — all in one place.</p>
          <div className={styles.heroBadges}>
            <div className={styles.heroBadge}>
              <ShieldCheck size={16} className={styles.heroBadgeIcon} />
              <span>Secure & Encrypted</span>
            </div>
            <div className={styles.heroBadge}>
              <Search size={16} className={styles.heroBadgeIcon} />
              <span>Real-time Tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== RIGHT — Form Panel ==================== */}
      <div className={styles.formPanel}>
        {/* Ambient glow (mobile) */}
        <div className={styles.ambientBackground}>
          <div className={styles.glowPink} />
          <div className={styles.glowBlue} />
          <div className={styles.glowPurple} />
        </div>

        {/* Back to Home (browser only) */}
        {!isStandalonePwa && !(typeof navigator !== 'undefined' && (navigator.userAgent || '').toLowerCase().includes('wv')) && (
          <button 
            type="button" 
            onClick={() => router.push('/')} 
            className={`${styles.backToHome} ${styles.animateIn}`}
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
        )}

        <div className={styles.formPanelInner}>
          {/* Brand */}
          <div className={`${styles.brand} ${styles.animateIn} ${styles.animateDelay1}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className={styles.brandLogo} />
            ) : (
              <div className={styles.brandLogoFallback}>
                <ShieldCheck size={26} color="#ffffff" />
              </div>
            )}
            <div className={styles.brandName}>{siteName}</div>
          </div>

          <div className={styles.loginCard}>
            {error && <div className={styles.errorBox}>{error}</div>}

            {/* Google Sign In */}
            <div className={`${styles.animateIn} ${styles.animateDelay3}`}>
              <button 
                type="button" 
                className={styles.googleBtn}
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google" 
                  className={styles.googleIcon}
                />
                <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
              </button>
            </div>

            <div className={`${styles.divider} ${styles.animateIn} ${styles.animateDelay3}`}>
              <span>or sign in with email</span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailLogin} className={`${styles.formSection} ${styles.animateIn} ${styles.animateDelay4}`}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="login-email">Email or Mobile</label>
                <div className={styles.inputWrapper}>
                  <Mail className={styles.inputIcon} size={16} />
                  <input
                    id="login-email"
                    type="text"
                    className={styles.loginInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>
              
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="login-password">Password</label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={16} />
                  <input
                    id="login-password"
                    type="password"
                    className={styles.loginInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className={styles.forgotRow}>
                <button type="button" onClick={() => setShowForgotPassword(true)} className={styles.forgotLink}>
                  Forgot Password?
                </button>
              </div>
              
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'} <LogIn size={18} strokeWidth={2.5} />
              </button>
            </form>
          </div>

          {/* Footer — Downloads & Privacy */}
          <div className={`${styles.footerSection} ${styles.animateIn} ${styles.animateDelay5}`}>
            <div className={styles.installBtnWrapper}>
              <InstallPWAButton />
            </div>

            <div className={styles.downloadRow}>
              <a href="/downloads/a1-hostels.apk" download className={styles.downloadBtn}>
                🤖 Android App
              </a>
              <button 
                onClick={() => alert("iOS Users: Please tap 'Download Web App' above, then 'Add to Home Screen' from Safari.")} 
                type="button" 
                className={styles.downloadBtn}
              >
                🍏 iOS App
              </button>
            </div>

            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.privacyLink}>
              Privacy Policy & Data Protection
            </a>
          </div>
        </div>
      </div>

      {/* ==================== FORGOT PASSWORD MODAL ==================== */}
      <AnimatePresence>
        {showForgotPassword && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modalCard}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Reset Password</h3>
                <button onClick={() => { setShowForgotPassword(false); setForgotPasswordMsg(null); }} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>
              <p className={styles.modalDescription}>
                Enter your registered email or mobile number and we'll send you a password reset link.
              </p>
              
              <form onSubmit={handleForgotPassword} className={styles.modalForm}>
                <input 
                  type="text" 
                  placeholder="Email or Mobile Number" 
                  className={styles.modalInput} 
                  value={forgotPasswordEmail} 
                  onChange={e => setForgotPasswordEmail(e.target.value)}
                  required
                />
                <button type="submit" className={styles.primaryButton} disabled={forgotPasswordLoading}>
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'} <Mail size={16} />
                </button>
              </form>

              {forgotPasswordMsg && (
                <div className={`${styles.modalAlert} ${forgotPasswordMsg.includes('sent') ? styles.modalAlertSuccess : styles.modalAlertError}`}>
                  {forgotPasswordMsg}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

