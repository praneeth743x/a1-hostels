"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { updatePassword, onAuthStateChanged } from 'firebase/auth';
import { rpcCall } from '@/lib/rpc';
import styles from '@/app/page.module.css';

import { Suspense } from 'react';

function SetupPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || !email) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [email, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!auth.currentUser) throw new Error("No authenticated user session found. Please login again.");

      // Set the password on the Firebase Auth user
      await updatePassword(auth.currentUser, password);

      // Update Firestore to mark account as initialized
      const res = await rpcCall('markAccountInitialized', email);
      if (!res.success) throw new Error(res.error || "Failed to update account status.");

      // Route the user appropriately
      let role = localStorage.getItem('userRole') || 'tenant';
      if (email === 'admin@raliving.com') role = 'super_admin';
      
      const target = role === 'super_admin' ? '/superadmin' : role === 'pg_owner' ? '/pgowner' : '/tenant';
      router.replace(target);

    } catch (err: any) {
      setError(err.message || "Failed to set password. Please try logging in again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPageContainer} style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
      <div className={styles.ambientBackground}>
        <div className={styles.glowPink}></div>
        <div className={styles.glowBlue}></div>
        <div className={styles.glowPurple}></div>
      </div>

      <motion.div 
        className={styles.modalContent}
        style={{ width: '90%', maxWidth: '400px', backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', zIndex: 10 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '50%', color: '#0ea5e9' }}>
            <ShieldCheck size={32} />
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: '0 0 8px 0', color: '#0f172a' }}>Secure Your Account</h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>
          Please set a password for <strong>{email}</strong> to complete your account setup.
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.inputWrapper}>
            <Lock className={styles.inputIcon} size={18} />
            <input
              type="password"
              className={styles.loginInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password"
              required
              disabled={loading}
              minLength={6}
            />
          </div>
          <div className={styles.inputWrapper}>
            <Lock className={styles.inputIcon} size={18} />
            <input
              type="password"
              className={styles.loginInput}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
              disabled={loading}
              minLength={6}
            />
          </div>
          
          <button type="submit" className={styles.primaryButton} disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'Saving...' : 'Set Password'} <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function SetupPassword() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>}>
      <SetupPasswordForm />
    </Suspense>
  );
}
