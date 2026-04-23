"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { supabase } from '@/lib/supabase';
import { getUserRole } from '@/app/actions/superadmin';
import styles from './page.module.css';

export default function LoginGateway() {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
      });
      
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) return;
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token: otp,
        type: 'sms'
      });
      
      if (error) throw error;
      
      if (data.user) {
        let role = 'tenant';

        // Automatically provision the specific Super Admin number
        if (phone === '9398699430') {
          role = 'super_admin';
          // Ensure the profile exists with the correct role
          await supabase.from('user_profiles').upsert({
            id: data.user.id,
            full_name: 'System Administrator',
            role: 'super_admin'
          });
        } else {
          // Fetch user profile securely via Server Action bypassing RLS issues
          role = await getUserRole(data.user.id);
        }
        
        // Route based on role
        if (role === 'super_admin') router.push('/superadmin');
        else if (role === 'pg_owner') router.push('/pgowner');
        else router.push('/tenant');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <motion.div 
        className={`${styles.loginCard} glass-card`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className={styles.logoContainer}>
          <div className={styles.pulseRingWrapper}>
            <motion.div className={`${styles.logo} animate-breathe pulse-ring`}></motion.div>
          </div>
          <h1 className={`${styles.brandTitle} text-indigo`}>StaySync</h1>
          <p className={`${styles.brandSubtitle} text-muted`}>The Smart Gateway</p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }}
              className="text-danger-red text-sm font-medium mb-4 text-center w-full bg-red-50 p-2 rounded-md border border-red-100"
              style={{ color: 'var(--danger-red)', backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: '8px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}
            >
              {error}
            </motion.div>
          )}
          {!otpSent ? (
            <motion.form
              key="phone-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSendOtp}
              className={styles.formSection}
            >
              <div className={styles.phoneInputWrapper}>
                <span className={styles.countryCode}>+91</span>
                <FloatingInput
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder=" "
                  required
                />
              </div>
              <AnimatedButton type="submit" isLoading={loading}>
                Continue
              </AnimatedButton>
            </motion.form>
          ) : (
            <motion.form
              key="otp-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleVerifyOtp}
              className={styles.formSection}
            >
              <FloatingInput
                label="Enter OTP"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder=" "
                required
                autoFocus
              />
              <AnimatedButton type="submit" isLoading={loading}>
                Verify & Enter
              </AnimatedButton>
              <button 
                type="button" 
                className={`${styles.backBtn} text-muted`}
                onClick={() => setOtpSent(false)}
                disabled={loading}
              >
                Change Phone Number
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
