"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import styles from '../tenant.module.css';
import { CustomSelect } from '@/components/CustomSelect';

export default function HelpDesk() {
  const [type, setType] = useState('plumbing');
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDesc('');
      }, 3000);
    }, 1500);
  };

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Help Desk</h1>
        <p className="text-muted text-sm mt-1">Raise a maintenance ticket</p>
      </header>

      <motion.form 
        className={styles.supportForm}
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <label className="text-sm font-medium mb-2 block">Issue Category</label>
          <CustomSelect 
            value={type}
            onChange={(val) => setType(val)}
            options={[
              { value: 'plumbing', label: 'Plumbing (e.g., Leaking Tap)' },
              { value: 'electrical', label: 'Electrical (e.g., Fan not working)' },
              { value: 'wifi', label: 'WiFi / Internet' },
              { value: 'cleaning', label: 'Room Cleaning' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Description</label>
          <textarea 
            className={styles.textareaField}
            placeholder="Please describe the issue in detail..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />
        </div>

        <AnimatedButton 
          type="submit" 
          isLoading={isSubmitting}
          disabled={submitted || desc.trim().length === 0}
        >
          {submitted ? (
            <>
              <CheckCircle size={18} className="mr-2" />
              Ticket Raised Successfully
            </>
          ) : (
            <>
              <Send size={18} className="mr-2" />
              Submit Ticket
            </>
          )}
        </AnimatedButton>
      </motion.form>
    </>
  );
}
