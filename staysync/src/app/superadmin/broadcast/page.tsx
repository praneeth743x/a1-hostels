"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import { supabase } from '@/lib/supabase';
import styles from '../superadmin.module.css';

export default function GlobalBroadcast() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setErrorMsg('');

    try {
      // Get all property IDs
      const { data: properties, error: propErr } = await supabase
        .from('properties')
        .select('pg_id');
        
      if (propErr) throw propErr;
      
      if (properties && properties.length > 0) {
        // Create an array of notices to insert
        const noticesToInsert = properties.map((p: any) => ({
          pg_id: p.pg_id,
          message: message.trim(),
        }));
        
        const { error: insertErr } = await supabase
          .from('notices')
          .insert(noticesToInsert);
          
        if (insertErr) throw insertErr;
      }
      
      // Mock API call for WhatsApp Blast to all tenants
      // sendWhatsAppReceipt(...)

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage('');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to broadcast');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Global Broadcast</h1>
          <p className={styles.pageSubtitle}>Send WhatsApp messages to all 2,500+ tenants instantly</p>
        </div>
      </header>

      <div className={styles.broadcastGrid}>
        <motion.div 
          className={`${styles.broadcastEditor} glass-card`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.cardHeader}>
            <MessageSquare size={20} className="text-indigo" />
            <h3>Compose Message</h3>
          </div>
          
          <form onSubmit={handleBroadcast} className={styles.broadcastForm}>
            {errorMsg && <div className="text-danger-red text-sm mb-2">{errorMsg}</div>}
            <div className={styles.textareaWrapper}>
              <textarea 
                className={styles.broadcastTextarea}
                placeholder="Type your message here... (e.g. Server maintenance scheduled for tonight at 2 AM)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                required
              />
              <div className={`${styles.charCount} text-muted`}>
                {message.length} characters
              </div>
            </div>

            <AnimatedButton 
              type="submit" 
              isLoading={isSending} 
              disabled={sent || message.trim().length === 0}
              className={styles.sendBlastBtn}
            >
              {sent ? 'Message Sent Successfully!' : (
                <>
                  <Send size={18} />
                  <span>Send to All Tenants</span>
                </>
              )}
            </AnimatedButton>
          </form>
        </motion.div>

        <motion.div 
          className={`${styles.broadcastInfo} glass-card`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h3 className={styles.infoTitle}>Broadcast Guidelines</h3>
          <ul className={`${styles.infoList} text-muted`}>
            <li>Messages are sent via the official Interakt WhatsApp API.</li>
            <li>Cost per message is approx ₹0.80. Total cost will be billed to the admin account.</li>
            <li>Avoid sending messages between 10 PM and 8 AM to comply with DND regulations.</li>
            <li>Ensure the message is urgent and relevant to all platform users.</li>
          </ul>
          
          <div className={styles.audienceEstimate}>
            <span className={styles.estimateLabel}>Estimated Audience:</span>
            <span className={`${styles.estimateValue} text-indigo`}>2,845 active tenants</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
