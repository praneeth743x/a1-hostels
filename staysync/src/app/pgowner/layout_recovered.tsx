"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, ClipboardList, LogOut, User, Building, Menu, Bell, X, ChevronRight, Banknote, Pizza, Camera, Folder, Globe, Languages, Headphones, Wallet, History } from 'lucide-react';
import styles from './pgowner.module.css';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getDashboardStats, getProperties } from '@/app/actions/pgowner';

export default function PGOwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('Venkateshwara Hostel');

  const [properties, setProperties] = useState<any[]>([]);
  const [activePgId, setActivePgId] = useState<string>('');

  return <>{children}</>;
}