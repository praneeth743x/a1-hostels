"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import styles from './page.module.css';

export default function LoginGateway() {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setLoading(true);
    // Mock Supabase Auth Delay
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
    }, 1200);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) return;
    setLoading(true);
    // Mock Verification Delay
    setTimeout(() => {
      setLoading(false);
      // Mock routing logic based on user role
      router.push('/pgowner');
    }, 1500);
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
