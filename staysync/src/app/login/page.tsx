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

export default function LoginPage() {
  const router = useRouter();

  const [isStandalonePwa, setIsStandalonePwa] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isCapacitor = (window as any).Capacitor || (window.parent && (window.parent as any).Capacitor) || navigator.userAgent.includes('Capacitor');
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone || document.referrer.includes('android-app://') || isCapacitor;
      setIsStandalonePwa(standalone);
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

  const { currentUser, authStatus } = useHostel();

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      getRedirectResult(auth).then(async (result) => {
        if (result && result.user) {
          sessionStorage.removeItem('loggedOut');
          setLoading(true);
          const user = result.user;
          if (!user.email) throw new Error("Google account must have an email.");

          const meta = await rpcCall('getLoginAuthMeta', user.uid, user.email);
          if (!meta?.exists) {
            await signOut(auth);
            throw new Error("This email is not registered. Please ask your PG Owner to add you.");
          }

          if (!meta?.isInitialized) {
            await rpcCall('markAccountInitialized', user.email).catch(() => {});
          }

          await routeUser(user.uid, user.email);
        }
      }).catch(e => {
        console.error("Redirect login error:", e);
        setError(e.message || "Failed to sign in with Google redirect.");
        setLoading(false);
      });
    }
  }, [router]);

  useEffect(() => {
    if (authStatus === 'READY' && currentUser) {
      const isExplicitLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('loggedOut') === 'true';

      if (currentUser.email && (!isExplicitLoggedOut || loading)) {
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

  const routeUser = async (userId: string | undefined, userEmail: string) => {
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

    rpcCall('registerDevice', userId, deviceId, deviceName).catch((e) => console.error("Background device registration error:", e));

    try {
      const fetchedRole = await rpcCall('getResolvedRole', userId, userEmail);

      if (!fetchedRole || (typeof fetchedRole === 'object' && fetchedRole.error)) {
        throw new Error((typeof fetchedRole === 'object' && fetchedRole.error) || "Role not found. Please contact support.");
      }

      const roleStr = typeof fetchedRole === 'string' ? fetchedRole : fetchedRole.role;

      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userUid', userId);
      localStorage.setItem('userRole', roleStr);

      const target = roleStr === 'super_admin' ? '/superadmin/owners' : roleStr === 'team_member' ? '/teammember/dashboard' : roleStr === 'pg_owner' ? '/pgowner/dashboard' : '/tenant';
      
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
    }
  };

  const handleGoogleSignIn = async () => {
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
      } else {
        // Web-based Google Sign-In popup
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

      const roleStr = meta.role || 'tenant';
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userUid', user.uid);
      localStorage.setItem('userRole', roleStr);

      const target = roleStr === 'super_admin' ? '/superadmin/owners' : roleStr === 'team_member' ? '/teammember/dashboard' : roleStr === 'pg_owner' ? '/pgowner/dashboard' : '/tenant';
      
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

    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log("Google sign in popup closed by user.");
      } else {
        console.error("Google sign in error:", err);
        setError(err?.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const roleStr = meta.role || 'tenant';
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userUid', userCredential.user.uid);
      localStorage.setItem('userRole', roleStr);

      const target = roleStr === 'super_admin' ? '/superadmin/owners' : roleStr === 'team_member' ? '/teammember/dashboard' : roleStr === 'pg_owner' ? '/pgowner/dashboard' : '/tenant';
      router.replace(target);
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
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

  if (showSplash && !redirectFired) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.loginPageContainer}>

      <div className={styles.ambientBackground}>
        <div className={styles.glowPink}></div>
        <div className={styles.glowBlue}></div>
        <div className={styles.glowPurple}></div>
      </div>

      <div className={`${styles.loginContent} ${styles.pwaModeContent}`}>
        <div className={styles.rightSection} style={{ flex: 'none' }}>
          <motion.div 
            layoutId="auth-card" 
            className={styles.loginCard}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className={styles.logoRow} style={{ justifyContent: 'center', marginBottom: '8px' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div className={styles.logoIcon} style={{ width: '24px', height: '24px' }}></div>
              )}
              <div className={`${styles.logoText} ${styles.textGradient}`} style={{ fontSize: '20px' }}>{siteName}</div>
            </div>

            <h2 className={styles.loginHeading} style={{ textAlign: 'center' }}>Sign In to Portal</h2>
            <p className={styles.loginSubtitle} style={{ textAlign: 'center' }}>Access your Tenant, Owner, or Super Admin account</p>

            {error && <div className={styles.errorBox}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <button 
                type="button" 
                className={styles.googleBtn}
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
                <span>Continue with Google</span>
              </button>

              <div className={styles.divider}>
                <span>OR SIGN IN DIRECTLY</span>
              </div>

              <form onSubmit={handleEmailLogin} className={styles.formSection}>
                <div className={styles.inputWrapper}>
                  <Mail className={styles.inputIcon} size={16} />
                  <input
                    type="text"
                    className={styles.loginInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address or Mobile Number"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={16} />
                  <input
                    type="password"
                    className={styles.loginInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    disabled={loading}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" onClick={() => setShowForgotPassword(true)} className={styles.forgotLink}>Forgot Password?</button>
                </div>
                
                <motion.button layoutId="primary-button" type="submit" className={styles.primaryButton} disabled={loading} style={{ marginTop: '12px' }}>
                  {loading ? 'Signing in...' : 'Sign In'} <LogIn size={16} strokeWidth={2.5} />
                </motion.button>
              </form>
            </div>
            
            <div style={{ marginTop: '14px' }}>
              <InstallPWAButton />
            </div>

            <div className={styles.nativeDownloadRow}>
              <a href="/a1-hostels.apk" download className={styles.nativeDownloadBtn}>
                🤖 Android App
              </a>
              <button 
                onClick={() => alert("iOS Users: Please tap the 'Download Web App' button above, then select 'Add to Home Screen' from your Safari share menu to install A1 Hostels as an app.")} 
                type="button" 
                className={styles.nativeDownloadBtn}
              >
                🍏 iOS App
              </button>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
                Privacy Policy & Data Protection
              </a>
            </div>
            
          </motion.div>
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>

        {showForgotPassword && (
          <div className={styles.modalOverlay} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div 
              className={styles.modalContent}
              style={{ width: '90%', maxWidth: '400px', backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Reset Password</h3>
                <button onClick={() => { setShowForgotPassword(false); setForgotPasswordMsg(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '16px' }}>Enter your registered email address or mobile number to receive a password reset link.</p>
              
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Email or Mobile Number" 
                  className={styles.loginInput} 
                  value={forgotPasswordEmail} 
                  onChange={e => setForgotPasswordEmail(e.target.value)}
                  required
                />
                <button type="submit" className={styles.primaryButton} disabled={forgotPasswordLoading}>
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'} <Mail size={16} />
                </button>
              </form>

              {forgotPasswordMsg && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: forgotPasswordMsg.includes('sent') ? '#dcfce7' : '#fee2e2', color: forgotPasswordMsg.includes('sent') ? '#166534' : '#991b1b', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
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
