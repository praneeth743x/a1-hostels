import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/login/app-login.module.css';

interface AppLoginProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  logoUrl: string;
  siteName: string;
  
  // Forgot Password modal props
  showForgotPasswordModal: boolean;
  setShowForgotPasswordModal: (show: boolean) => void;
  forgotPasswordEmail: string;
  setForgotPasswordEmail: (val: string) => void;
  forgotPasswordMsg: string | null;
  setForgotPasswordMsg: (msg: string | null) => void;
  forgotPasswordLoading: boolean;
  onForgotPasswordSubmit: (e: React.FormEvent) => void;
}

export default function AppLogin({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  error,
  onSubmit,
  onGoogleSignIn,
  logoUrl,
  siteName,
  showForgotPasswordModal,
  setShowForgotPasswordModal,
  forgotPasswordEmail,
  setForgotPasswordEmail,
  forgotPasswordMsg,
  setForgotPasswordMsg,
  forgotPasswordLoading,
  onForgotPasswordSubmit
}: AppLoginProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.ambientGlow} />
      
      <motion.div 
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className={styles.logoFrame}>
          <img 
            src={logoUrl || '/himalaya_logo_premium.png'} 
            alt="Logo" 
            className={styles.logoImage} 
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/himalaya_logo_premium.png';
            }}
          />
        </div>
        
        <h2 className={styles.heading}>
          Welcome <span className={styles.highlightText}>Back</span>
        </h2>
        <p className={styles.subtitle}>Sign in to continue to your portal</p>
        
        {error && <div className={styles.errorBox}>{error}</div>}
        
        <form onSubmit={onSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <Mail className={styles.inputIcon} size={20} />
            <input 
              type="text"
              placeholder="Email address or mobile number"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <Lock className={styles.inputIcon} size={20} />
            <input 
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className={`${styles.input} ${styles.inputWithToggle}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
            <button 
              type="button" 
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          <div className={styles.forgotPasswordRow}>
            <button 
              type="button" 
              className={styles.forgotPasswordLink}
              onClick={() => {
                setForgotPasswordMsg(null);
                setShowForgotPasswordModal(true);
              }}
            >
              Forgot Password?
            </button>
          </div>
          
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
        
        <div className={styles.divider}>or continue with</div>
        
        <button 
          type="button" 
          className={styles.googleButton}
          onClick={onGoogleSignIn}
          disabled={loading}
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google logo" 
            style={{ width: '18px', height: '18px' }} 
          />
          <span>{loading ? 'Signing in with Google...' : 'Continue with Google'}</span>
        </button>
      </motion.div>
      
      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPasswordModal && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modal}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Reset Password</h3>
                <button 
                  onClick={() => {
                    setShowForgotPasswordModal(false);
                    setForgotPasswordMsg(null);
                  }} 
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>
              
              <p className={styles.modalDescription}>
                Enter your registered email address or mobile number to receive a password reset link.
              </p>
              
              <form onSubmit={onForgotPasswordSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <Mail className={styles.inputIcon} size={20} />
                  <input 
                    type="text" 
                    placeholder="Email or Mobile Number" 
                    className={styles.input} 
                    value={forgotPasswordEmail} 
                    onChange={e => setForgotPasswordEmail(e.target.value)}
                    required
                    disabled={forgotPasswordLoading}
                  />
                </div>
                
                <button 
                  type="submit" 
                  className={styles.submitButton} 
                  disabled={forgotPasswordLoading}
                >
                  <span>{forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}</span>
                  {!forgotPasswordLoading && <Mail size={16} />}
                </button>
              </form>
              
              {forgotPasswordMsg && (
                <div className={`${styles.modalMsgBox} ${forgotPasswordMsg.includes('sent') ? styles.modalMsgSuccess : styles.modalMsgError}`}>
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
