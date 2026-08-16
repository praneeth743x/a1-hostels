"use client";

import React, { useState, useEffect } from 'react';
import { avatarCache } from '@/lib/avatarCache';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface AvatarImageProps {
  src?: string | null;
  alt: string;
  name: string;
  size?: number;
  priority?: boolean;
  className?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = React.memo(({
  src,
  alt,
  name,
  size = 44,
  priority = true,
  className = '',
}) => {
  const cachedSrc = avatarCache.get(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(cachedSrc);
  const [hasError, setHasError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mounted, setMounted] = useState(false);

  const initialLetter = (name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!src) {
      setLoadedSrc(null);
      return;
    }
    const cached = avatarCache.get(src);
    if (cached) {
      setLoadedSrc(cached);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    img.onload = () => {
      if (isMounted) {
        avatarCache.set(src, src);
        setLoadedSrc(src);
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setHasError(true);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src]);

  return (
    <>
      <div
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowPreview(true);
        }}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#4F6DFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          userSelect: 'none',
          transform: 'translateZ(0)',
          border: '2px solid #e2e8f0',
          boxSizing: 'border-box',
          cursor: 'pointer'
        }}
      >
        {loadedSrc && !hasError ? (
          <img
            src={loadedSrc}
            alt={alt}
            decoding="async"
            loading={priority ? 'eager' : 'lazy'}
            {...(priority ? ({ fetchPriority: 'high' } as any) : {})}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
            }}
            onError={() => setHasError(true)}
          />
        ) : (
          <span
            style={{
              fontWeight: 700,
              fontSize: `${Math.round(size * 0.45)}px`,
              color: '#FFFFFF',
              lineHeight: 1,
            }}
          >
            {initialLetter}
          </span>
        )}
      </div>

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showPreview && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999999,
                backgroundColor: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPreview(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                style={{
                  width: '300px',
                  height: '300px',
                  backgroundColor: '#fff',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '12px 16px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
                    color: 'white',
                    zIndex: 10,
                    fontSize: '18px',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                >
                  {name}
                </div>
                {loadedSrc && !hasError ? (
                  <img
                    src={loadedSrc}
                    alt={alt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#4F6DFF',
                      fontSize: '120px',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    {initialLetter}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});

AvatarImage.displayName = 'AvatarImage';
