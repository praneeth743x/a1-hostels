"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AlertTriangle, AlertCircle, CheckCircle, Info } from "lucide-react";
import styles from "./ConfirmDialog.module.css";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
};

type AlertOptions = {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showAlert: (options: AlertOptions | string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions>({ message: "" });
  const [confirmResolver, setConfirmResolver] = useState<{ resolve: (value: boolean) => void } | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertOpts, setAlertOpts] = useState<AlertOptions>({ message: "" });
  const [alertResolver, setAlertResolver] = useState<{ resolve: () => void } | null>(null);

  const confirm = (opts: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmOpts(typeof opts === "string" ? { message: opts } : opts);
      setConfirmOpen(true);
      setConfirmResolver({ resolve });
    });
  };

  const showAlert = (opts: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const parsed = typeof opts === "string" ? { message: opts } : opts;
      setAlertOpts(parsed);
      setAlertOpen(true);
      setAlertResolver({ resolve });
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.alert = (msg: string) => {
        let variant: AlertOptions['variant'] = 'info';
        let title = 'Notice';

        const lower = (msg || '').toLowerCase();
        if (lower.includes('fail') || lower.includes('error') || lower.includes('already exists') || lower.includes('cannot') || lower.includes('invalid')) {
          variant = 'danger';
          title = 'Attention';
        } else if (lower.includes('success') || lower.includes('saved') || lower.includes('completed') || lower.includes('resumed')) {
          variant = 'success';
          title = 'Success';
        } else if (lower.includes('warn') || lower.includes('please select')) {
          variant = 'warning';
          title = 'Warning';
        }

        showAlert({
          title,
          message: msg,
          variant
        });
      };
    }
  }, []);

  const handleConfirmAction = (result: boolean) => {
    setConfirmOpen(false);
    if (confirmResolver) confirmResolver.resolve(result);
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
    if (alertResolver) alertResolver.resolve();
  };

  return (
    <ConfirmContext.Provider value={{ confirm, showAlert }}>
      {children}

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className={styles.modalOverlay} onClick={() => handleConfirmAction(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalBody}>
              <div className={`${styles.iconContainer} ${styles[confirmOpts.variant || 'danger']}`}>
                <AlertTriangle size={22} strokeWidth={2.5} />
              </div>
              <div className={styles.textContent}>
                <h3 className={styles.title}>
                  {confirmOpts.title || "Confirm Action"}
                </h3>
                <p className={styles.message}>
                  {confirmOpts.message}
                </p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={() => handleConfirmAction(false)}
                className={styles.cancelBtn}
              >
                {confirmOpts.cancelText || "Cancel"}
              </button>
              <button
                onClick={() => handleConfirmAction(true)}
                className={styles.confirmBtn}
              >
                {confirmOpts.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern In-App Alert Modal */}
      {alertOpen && (
        <div className={styles.modalOverlay} onClick={handleAlertClose}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalBody}>
              <div className={`${styles.iconContainer} ${styles[alertOpts.variant || 'danger']}`}>
                {alertOpts.variant === 'success' ? (
                  <CheckCircle size={22} strokeWidth={2.5} />
                ) : alertOpts.variant === 'warning' ? (
                  <AlertTriangle size={22} strokeWidth={2.5} />
                ) : alertOpts.variant === 'info' ? (
                  <Info size={22} strokeWidth={2.5} />
                ) : (
                  <AlertCircle size={22} strokeWidth={2.5} />
                )}
              </div>
              <div className={styles.textContent}>
                <h3 className={styles.title}>
                  {alertOpts.title || (alertOpts.variant === 'danger' ? 'Attention' : 'Notice')}
                </h3>
                <p className={styles.message}>
                  {alertOpts.message}
                </p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={handleAlertClose}
                className={styles.alertOkBtn}
                autoFocus
              >
                {alertOpts.buttonText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
};

export const useAlert = () => {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error("useAlert must be used within a ConfirmProvider");
  }
  return context.showAlert;
};
