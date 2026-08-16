"use client";

import React, { type ComponentProps } from 'react';
import { motion } from 'framer-motion';

interface PressableProps extends ComponentProps<typeof motion.div> {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  scaleDown?: number;
}

export const Pressable: React.FC<PressableProps> = React.memo(({
  children,
  className = '',
  onClick,
  onPointerDown,
  onTouchStart,
  scaleDown = 0.97,
  ...props
}) => {
  return (
    <motion.div
      whileTap={{ scale: scaleDown }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      style={{ touchAction: 'manipulation', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transform: 'translateZ(0)' }}
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
});

Pressable.displayName = 'Pressable';
