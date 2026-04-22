import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FloatingInput } from '../components/FloatingInput';
import { AnimatedButton } from '../components/AnimatedButton';
import './Login.css';

export const Login: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setLoading(true);
    // Mock Firebase Phone Auth Delay
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
      // For now, redirect to superadmin
      navigate('/superadmin');
    }, 1500);
  };

  return (
    <div className="login-container">
      <motion.div 
        className="login-card glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="logo-container">
          <div className="pulse-ring-wrapper">
            <motion.div className="logo animate-breathe pulse-ring"></motion.div>
          </div>
          <h1 className="brand-title text-indigo">StaySync</h1>
          <p className="brand-subtitle text-muted">The Smart Gateway</p>
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
              className="form-section"
            >
              <div className="phone-input-wrapper">
                <span className="country-code">+91</span>
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
              className="form-section"
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
                className="back-btn text-muted"
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
};
