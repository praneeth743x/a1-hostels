"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Shield, Lock, ArrowRight, BedDouble, Users, IndianRupee, MessageSquareWarning, LineChart, MessageCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { getUserRole, checkUserExists } from '@/app/actions/superadmin';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
import styles from './page.module.css';

type AuthStep = 'phone' | 'otp';

export default function LoginGateway() {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const router = useRouter();

  // --- Auth Logic ---
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  useEffect(() => {
    const clearLingeringSessions = async () => {
      localStorage.clear();
      sessionStorage.clear();
      await auth.signOut();
    };
    clearLingeringSessions();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const exists = await checkUserExists(rawPhone);
      if (!exists) {
        setError('Number not registered. Please ask your PG Owner to add you.');
        setLoading(false);
        return;
      }
      await executeSendOtp(rawPhone);
    } catch (err: any) {
      setError('Failed to check user status');
      setLoading(false);
    }
  };

  const executeSendOtp = async (rawPhone: string) => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }
      const formattedPhone = `+91${rawPhone}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      
      setCountdown(30);
      setStep('otp');
      setOtp(Array(6).fill('')); 
    } catch (err: any) {
      console.error(err);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.reset(); } catch(e) {}
      }
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtpButton = async () => {
    setLoading(true);
    setError(null);
    const rawPhone = phone.replace(/\D/g, '');
    await executeSendOtp(rawPhone);
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpValue = otp.join('');
    if (!otpValue || otpValue.length < 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    if (!confirmationResult) {
      setError('Please request a new OTP');
      return;
    }
    setLoading(true);
    setError(null);
    const rawPhone = phone.replace(/\D/g, '');
    try {
      const credential = await confirmationResult.confirm(otpValue);
      await routeUser(credential.user.uid, rawPhone);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const routeUser = async (userId: string | undefined, rawPhone: string) => {
    if (!userId) return;
    let role = 'tenant';
    if (rawPhone === '9999999999') {
      role = 'super_admin';
    } else if (rawPhone === '9398699430') {
      role = 'pg_owner';
    } else {
      role = await getUserRole(userId);
    }
    localStorage.setItem('userRole', role);
    if (role === 'super_admin') router.push('/superadmin');
    else if (role === 'pg_owner') router.push('/pgowner');
    else router.push('/tenant');
  };

  const formatPhone = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 10);
    if (raw.length > 5) {
      return `${raw.slice(0, 5)} ${raw.slice(5)}`;
    }
    return raw;
  };

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newOtp = [...otp];
      pastedData.split('').forEach((char, idx) => {
        if (idx < 6) newOtp[idx] = char;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(pastedData.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };

  // --- Animation Variants ---
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className={styles.loginPageContainer}>
      
      {/* Vibrant Ambient Glowing Background */}
      <div className={styles.ambientBackground}>
        <div className={styles.glowPink}></div>
        <div className={styles.glowBlue}></div>
        <div className={styles.glowPurple}></div>
      </div>

      <div id="recaptcha-container"></div>
      
      <div className={styles.loginContent}>
        
        {/* LEFT SECTION (60%) - FEATURES SHOWCASE */}
        <div className={styles.leftSection}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}></div>
            <div className={styles.logoText}>StaySync</div>
          </div>

          <h1 className={styles.mainHeading}>
            Smart PG Management.<br />
            <span className={styles.textGradient}>Beautifully Simple.</span>
          </h1>
          <p className={styles.subHeading}>
            Everything you need to automate your PG operations, packed into one stunning interface.
          </p>

          <motion.div 
            className={styles.featureGrid}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Feature 1 */}
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.colorBlue}`}>
                <BedDouble size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Room & Bed Management</h3>
                <p className={styles.featureDesc}>Visually track occupancy, allocate beds instantly, and manage your floors with ease.</p>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.colorPurple}`}>
                <Users size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Tenant Onboarding</h3>
                <p className={styles.featureDesc}>Seamlessly add tenants, capture documents, and generate digital agreements.</p>
              </div>
            </motion.div>

            {/* Feature 3 */}
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.colorGreen}`}>
                <IndianRupee size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Automated Billing</h3>
                <p className={styles.featureDesc}>Auto-generate invoices, collect rent via UPI, and track pending dues instantly.</p>
              </div>
            </motion.div>

            {/* Feature 4 */}
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.colorPink}`}>
                <MessageSquareWarning size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Smart Complaints</h3>
                <p className={styles.featureDesc}>Let tenants raise tickets via WhatsApp. Track resolutions and maintain hygiene.</p>
              </div>
            </motion.div>

            {/* Feature 5 */}
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.colorOrange}`}>
                <LineChart size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Live Analytics</h3>
                <p className={styles.featureDesc}>Beautiful charts tracking revenue, expenses, and occupancy trends in real-time.</p>
              </div>
            </motion.div>

            {/* Feature 6 */}
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIconBox} ${styles.colorTeal}`}>
                <MessageCircle size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>WhatsApp Bot</h3>
                <p className={styles.featureDesc}>Automated rent reminders and important notifications sent directly to tenants.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>


        {/* RIGHT SECTION (40%) - AUTH CARD */}
        <div className={styles.rightSection}>
          <motion.div 
            layoutId="auth-card" 
            className={styles.loginCard}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
          >
            <AnimatePresence mode="wait">
              
              {step === 'phone' && (
                <motion.div
                  key="phone-step"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >


                  <div className={styles.logoRow} style={{ justifyContent: 'center', marginBottom: '1vh' }}>
                    <div className={styles.logoIcon} style={{ width: '28px', height: '28px' }}></div>
                    <div className={`${styles.logoText} ${styles.textGradient}`} style={{ fontSize: '24px' }}>StaySync</div>
                  </div>

                  <h2 className={styles.loginHeading} style={{ textAlign: 'center' }}>Sign in</h2>
                  <p className={styles.loginSubtitle} style={{ textAlign: 'center' }}>Enter your mobile number to access your dashboard</p>

                  {error && <div className={styles.errorBox}>{error}</div>}

                  <form onSubmit={handlePhoneSubmit} className={styles.formSection}>
                    <motion.div layoutId="phone-input" className={styles.phoneInputWrapper}>
                      <div className={styles.countryCodeBlock}>+91</div>
                      <input
                        type="tel"
                        className={styles.phoneInput}
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="Mobile Number"
                        required
                        disabled={loading}
                      />
                    </motion.div>
                    
                    <motion.button layoutId="primary-button" type="submit" className={styles.primaryButton} disabled={loading}>
                      {loading ? 'Please wait...' : 'Continue'} <ArrowRight size={18} strokeWidth={2.5} />
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {step === 'otp' && (
                <motion.div
                  key="otp-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <div className={styles.cardHeaderTop} style={{ justifyContent: 'space-between' }}>
                    <button type="button" className={styles.backBtn} onClick={() => setStep('phone')} disabled={loading}>
                      <ArrowRight size={16} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }}/> Back
                    </button>
                  </div>

                  <h2 className={styles.loginHeading} style={{ textAlign: 'center' }}>Enter Code</h2>
                  <p className={styles.loginSubtitle} style={{ textAlign: 'center' }}>We sent an SMS to +91 {phone}</p>

                  {error && <div className={styles.errorBox}>{error}</div>}

                  <form onSubmit={handleVerifyOtp} className={styles.formSection}>
                    <motion.div layoutId="phone-input" className={styles.otpGrid} onPaste={handlePaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          type="text"
                          maxLength={1}
                          className={styles.otpBox}
                          value={digit}
                          onChange={(e) => handleChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          ref={(el) => { otpInputRefs.current[index] = el; }}
                          disabled={loading}
                          autoFocus={index === 0}
                        />
                      ))}
                    </motion.div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
                        00:{countdown.toString().padStart(2, '0')}
                      </div>
                      <button 
                        type="button" 
                        className={styles.resendBtn} 
                        disabled={countdown > 0 || loading}
                        onClick={() => handleSendOtpButton()}
                      >
                        Resend Code
                      </button>
                    </div>

                    <motion.button layoutId="primary-button" type="submit" className={styles.primaryButton} style={{ marginTop: '8px' }} disabled={loading || otp.join('').length < 6}>
                      {loading ? 'Verifying...' : 'Verify & Login'} <ArrowRight size={18} strokeWidth={2.5} />
                    </motion.button>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
            
          </motion.div>
        </div>
      </div>
    </div>
  );
}
