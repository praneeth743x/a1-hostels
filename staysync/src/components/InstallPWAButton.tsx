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
             <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>Install A1 Hostels</h3>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
               {/* Android Section */}
               <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                 <h4 style={{ margin: '0 0 6px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 700 }}>
                   🤖 Android (Chrome)
                 </h4>
                 <ol style={{ paddingLeft: '18px', margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: '1.4' }}>
                   <li style={{ marginBottom: '4px' }}>Tap the browser menu (three dots in the top right corner).</li>
                   <li>Select <strong>Install App</strong> or <strong>Add to Home Screen</strong>.</li>
                 </ol>
               </div>

               {/* iOS Section */}
               <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                 <h4 style={{ margin: '0 0 6px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 700 }}>
                   🍏 iOS / iPhone (Safari)
                 </h4>
                 <ol style={{ paddingLeft: '18px', margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: '1.4' }}>
                   <li style={{ marginBottom: '4px' }}>
                     Tap the <strong>Share</strong> button <Share size={12} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> at the bottom of Safari.
                   </li>
                   <li>
                     Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={12} style={{ display: 'inline', verticalAlign: 'text-bottom' }} />.
                   </li>
                 </ol>
               </div>
             </div>
            
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
