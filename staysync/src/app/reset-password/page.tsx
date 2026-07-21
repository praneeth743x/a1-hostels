"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { auth } from '@/lib/firebase';
import { getUserRole } from '@/app/actions/superadmin';
import styles from '../page.module.css';
import { ShieldCheck } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const successRef = useRef(false);
  const router = useRouter();

  // Ensure that if the user closes the 'Set New Password' screen without finishing, the temporary session is destroyed
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        if (isMounted) router.push('/');
      } else {
        if (isMounted) setAuthChecked(true);
      }
    };
    checkAuth();

    const handleBeforeUnload = () => {
      if (!successRef.current) {
        auth.signOut();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (!successRef.current) {
        auth.signOut();
      }
    };
  }, [router]);

  useEffect(() => {
    successRef.current = success;
  }, [success]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Password reset is no longer needed with OTP phone auth, just push to dashboard
      setSuccess(true);
      
      setTimeout(async () => {
        const user = auth.currentUser;
        if (user) {
          const rawPhone = user.phoneNumber?.replace('+', '').replace('91', '') || '';
          let role = 'tenant';
          if (rawPhone === '9398699430') {
             role = 'super_admin';
          } else {
             role = await getUserRole(user.uid);
          }
          localStorage.setItem('userRole', role);
          
          if (role === 'super_admin') router.push('/superadmin');
          else if (role === 'pg_owner') router.push('/pgowner');
          else router.push('/tenant');
        } else {
          router.push('/');
        }
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) return null;

  return (
    <div className={styles.loginContainer}>
      <motion.div 
        className={`${styles.loginCard} glass-card`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.form
              key="reset-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleReset}
              className={styles.formSection}
            >
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '8px' }}>Set New Password</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please enter a strong password for your account.</p>
              </div>

              {error && (
                <div style={{ color: 'var(--danger-red)', backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: '8px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <FloatingInput
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                required
              />
              
              <FloatingInput
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder=" "
                required
              />
              
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', marginTop: '-8px' }}>
                <div style={{ height: '4px', flex: 1, backgroundColor: password.length > 0 ? (password.length > 5 ? 'var(--success-green)' : 'var(--warning-yellow)') : 'var(--border-light)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                <div style={{ height: '4px', flex: 1, backgroundColor: password.length > 5 && password.match(/[A-Z]/) ? 'var(--success-green)' : 'var(--border-light)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                <div style={{ height: '4px', flex: 1, backgroundColor: password.length > 5 && password.match(/[0-9]/) ? 'var(--success-green)' : 'var(--border-light)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '-8px', textAlign: 'right' }}>
                {password.length < 6 ? 'Too short' : password.match(/[A-Z]/) && password.match(/[0-9]/) ? 'Strong' : 'Medium'}
              </div>

              <AnimatedButton type="submit" isLoading={loading}>
                Update Password
              </AnimatedButton>
            </motion.form>
          ) : (
            <motion.div
              key="success-screen"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '2rem 0' }}
            >
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(76, 175, 80, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck color="var(--success-green)" size={40} />
              </div>
              <h2 style={{ color: 'var(--success-green)', fontSize: '1.5rem' }}>Password Updated!</h2>
              <p style={{ color: 'var(--text-muted)' }}>Redirecting to your dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
