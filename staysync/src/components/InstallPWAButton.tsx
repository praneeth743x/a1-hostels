"use client";

import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import styles from './InstallPWAButton.module.css';

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstruction, setShowIOSInstruction] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Check if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Native Chrome/Android prompt available
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
    } else {
      // Show fallback instruction modal for iOS and unsupported desktop browsers
      setShowIOSInstruction(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button className={styles.installButton} onClick={handleInstallClick} type="button">
        <Download size={20} />
        <span>Download Web App</span>
      </button>

      {/* Fallback Instructions Modal */}
      {showIOSInstruction && (
        <div className={styles.modalOverlay} onClick={() => setShowIOSInstruction(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModalBtn} onClick={() => setShowIOSInstruction(false)}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>Install Raliving App</h3>
            
            {isIOS ? (
              <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
                <p style={{ marginBottom: '12px' }}>To install the Raliving app on your iPhone or iPad:</p>
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                  <li style={{ marginBottom: '10px' }}>
                    Tap the <strong>Share</strong> button <Share size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> at the bottom of your screen.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} />.
                  </li>
                </ol>
              </div>
            ) : (
              <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
                <p style={{ marginBottom: '12px' }}>To install the app on this browser:</p>
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                  <li style={{ marginBottom: '10px' }}>
                    Click the browser menu (three dots in the top right corner).
                  </li>
                  <li>
                    Select <strong>Install App</strong> or <strong>Add to Home Screen</strong>.
                  </li>
                </ol>
                <p style={{ marginTop: '16px', fontSize: '0.85rem', color: '#64748b' }}>
                  (If you don't see this option, look for an install icon <Download size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> in the right side of your URL bar).
                </p>
              </div>
            )}
            
            <button 
              onClick={() => setShowIOSInstruction(false)}
              style={{
                width: '100%', padding: '12px', background: '#3F51B5', color: 'white', 
                border: 'none', borderRadius: '8px', marginTop: '24px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
