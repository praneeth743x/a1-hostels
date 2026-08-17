"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { LogIn, ShieldCheck, ChevronLeft, ChevronRight, Sparkles, ArrowUpRight, Menu, X, Home, PhoneCall, Bed, User } from 'lucide-react';
import { getLandingSettings, getPublicHostels } from '@/app/actions/superadmin';
import styles from './page.module.css';

interface Slide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
}

const getTransitionVariants = (type: string) => {
  switch (type) {
    case 'liquid_aurora':
      return {
        initial: { opacity: 0, scale: 1.15, filter: 'blur(20px) hue-rotate(90deg)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px) hue-rotate(0deg)' },
        exit:    { opacity: 0, scale: 0.9, filter: 'blur(20px) hue-rotate(-90deg)' },
        transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }
      };
    case 'shattered_glass':
      return {
        initial: { opacity: 0, scale: 1.2, rotate: -5, skewX: -10 },
        animate: { opacity: 1, scale: 1, rotate: 0, skewX: 0 },
        exit:    { opacity: 0, scale: 0.8, rotate: 5, skewX: 10 },
        transition: { duration: 0.8, ease: "easeInOut" as const }
      };
    case 'cosmic_portal':
      return {
        initial: { opacity: 0, scale: 0.2, rotateX: 90 },
        animate: { opacity: 1, scale: 1, rotateX: 0 },
        exit:    { opacity: 0, scale: 2, rotateX: -90 },
        transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }
      };
    case 'neon_glitch_storm':
      return {
        initial: { opacity: 0, x: -100, skewY: 15 },
        animate: { opacity: 1, x: 0, skewY: 0 },
        exit:    { opacity: 0, x: 100, skewY: -15 },
        transition: { duration: 0.7, ease: "easeInOut" as const }
      };
    case 'obsidian_mirror':
      return {
        initial: { opacity: 0, rotateY: 180 },
        animate: { opacity: 1, rotateY: 0 },
        exit:    { opacity: 0, rotateY: -180 },
        transition: { duration: 0.9, ease: "easeInOut" as const }
      };
    case 'supernova_burst':
      return {
        initial: { opacity: 0, scale: 3, filter: 'brightness(2)' },
        animate: { opacity: 1, scale: 1, filter: 'brightness(1)' },
        exit:    { opacity: 0, scale: 0.1, filter: 'brightness(3)' },
        transition: { duration: 0.8, ease: "easeOut" as const }
      };
    case 'silk_veil_drop':
      return {
        initial: { opacity: 0, y: '-100%' },
        animate: { opacity: 1, y: 0 },
        exit:    { opacity: 0, y: '100%' },
        transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const }
      };
    case 'quantum_fold':
      return {
        initial: { opacity: 0, scaleX: 0, rotateZ: -15 },
        animate: { opacity: 1, scaleX: 1, rotateZ: 0 },
        exit:    { opacity: 0, scaleX: 0, rotateZ: 15 },
        transition: { duration: 0.8, ease: "easeInOut" as const }
      };
    case 'molten_lava':
      return {
        initial: { opacity: 0, scaleY: 1.5, filter: 'sepia(1)' },
        animate: { opacity: 1, scaleY: 1, filter: 'sepia(0)' },
        exit:    { opacity: 0, scaleY: 0.5, filter: 'sepia(1)' },
        transition: { duration: 0.95, ease: "easeInOut" as const }
      };
    case 'time_warp':
      return {
        initial: { opacity: 0, scaleX: 2, filter: 'blur(10px)' },
        animate: { opacity: 1, scaleX: 1, filter: 'blur(0px)' },
        exit:    { opacity: 0, scaleX: 0.5, filter: 'blur(10px)' },
        transition: { duration: 0.7, ease: "easeInOut" as const }
      };
    case 'venetian_blinds':
      return {
        initial: { opacity: 0, scaleY: 0 },
        animate: { opacity: 1, scaleY: 1 },
        exit:    { opacity: 0, scaleY: 0 },
        transition: { duration: 0.75, ease: "easeInOut" as const }
      };
    case 'ethereal_ghost':
      return {
        initial: { opacity: 0, y: 40, filter: 'blur(15px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit:    { opacity: 0, y: -40, filter: 'blur(15px)' },
        transition: { duration: 0.9, ease: "easeOut" as const }
      };
    case 'kaleidoscope_spin':
      return {
        initial: { opacity: 0, rotate: -360, scale: 0.3 },
        animate: { opacity: 1, rotate: 0, scale: 1 },
        exit:    { opacity: 0, rotate: 360, scale: 0.3 },
        transition: { duration: 0.9, ease: "easeInOut" as const }
      };
    case 'ice_shatter':
      return {
        initial: { opacity: 0, scale: 1.2, filter: 'invert(0.5)' },
        animate: { opacity: 1, scale: 1, filter: 'invert(0)' },
        exit:    { opacity: 0, scale: 0.8, filter: 'invert(0.5)' },
        transition: { duration: 0.8, ease: "easeInOut" as const }
      };
    case 'velvet_slide':
      return {
        initial: { opacity: 0, x: '100%' },
        animate: { opacity: 1, x: 0 },
        exit:    { opacity: 0, x: '-100%' },
        transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const }
      };
    case 'blackhole_absorb':
      return {
        initial: { opacity: 0, scale: 0, rotate: 360 },
        animate: { opacity: 1, scale: 1, rotate: 0 },
        exit:    { opacity: 0, scale: 0, rotate: -360 },
        transition: { duration: 0.9, ease: "easeInOut" as const }
      };
    case 'retro_vhs':
      return {
        initial: { opacity: 0, skewX: 20, filter: 'contrast(1.5)' },
        animate: { opacity: 1, skewX: 0, filter: 'contrast(1)' },
        exit:    { opacity: 0, skewX: -20, filter: 'contrast(1.5)' },
        transition: { duration: 0.7, ease: "easeInOut" as const }
      };
    case 'graviton_sweep':
      return {
        initial: { opacity: 0, x: -150, y: -150, rotate: -15 },
        animate: { opacity: 1, x: 0, y: 0, rotate: 0 },
        exit:    { opacity: 0, x: 150, y: 150, rotate: 15 },
        transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const }
      };
    case 'gradient_depixelate':
    default:
      return {
        initial: { opacity: 0, scale: 1.08, filter: 'blur(10px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit:    { opacity: 0, scale: 0.92, filter: 'blur(10px)' },
        transition: { duration: 0.8, ease: "easeInOut" as const }
      };
  }
};

const DEFAULT_SLIDES: Slide[] = [
  {
    id: '1',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1ybc4RDJcJCi0vesS4Kdhno7cvHG0nV0SrX9qYRRAuNE74f3AT9fvhQZSh6QXDC0MTiIjZfRyKlpYhZYt3nwU-m4ryDwg9eKqZfmuw8pDCIdLe0qvQnHSFWF_cQMaYigYn9TFDVs1fDCRbIqTnsPlQtDgbeuyyP5PQI5oNXy3bLkwMzLqMMLzwWcqn5GmEWcloVC5iheKI9ghf6sKn6QYheYdxLVQyrvIIHSDSfDzjTF7tulkyPnH',
    title: 'Himalayan Luxury Suites',
    subtitle: 'Panoramic Alpine Views & Glacial Quiet'
  },
  {
    id: '2',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBgozEEjIruvwkrAL77UDylnJyQHalhexX_4Nz2_zJZpWTvLlHxduGsxIaeUEpZyGQIAyyi4EWeQYNXd96svCysC12Dict_aRVVdu6Wci-Se2oTXhbPta4BfwgZFJ_-yh4iKANFXdtRqVcvCH1lUnvjAiWzV6vXOLwIq9jNU78jNRKOsp0J-CJG0H0SZj1LkKeqrNgM2qf5S6GAcERwG5yyIqlTx0RAptOdWypYT2FM-9AnsQWa2Sks',
    title: 'Hydrotherapy Sanctuary',
    subtitle: 'Marble Soaking Tubs & Thermal Springs'
  },
  {
    id: '3',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmcfMeigKgGLlkNwazD88lXYhThlEFANadWLtzM9aaNQWiowE44XXrIhaLqx19W_fUV_TnwKpRhVnqoQRaMrkPw5m6zsJKnj4TLrENzh4ie8tPRNVbiYU-vgOo36eAswwDtNMl46RePLd7a9il8qDQmgaCCQM-NqCFYHrKqHuWZ7Z4qcBlFT4WsXyJCNDICfQXkYW0ePQLSpDEocE54ACUbgi2EHMOoEe3c6wCjX4rg8nrAsM7nAnsQWa2Sks',
    title: 'Glass Disconnection Dome',
    subtitle: 'Cliffside Stargazing & Pure Oxygen Lounges'
  }
];

export interface PublicHostel {
  id: string;
  name: string;
  address: string;
  locationLink: string;
  description: string;
  imageUrl: string;
  images: string[];
  amenities: string[];
  facilities: string[];
  gender: string;
  totalRooms: number;
  pgId: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  distanceKm?: number;
}

interface LandingClientProps {
  initialSettings: any;
  initialHostels: PublicHostel[];
}

export default function LandingClient({ initialSettings, initialHostels }: LandingClientProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch('/login');
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone || document.referrer.includes('android-app://');
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const userRole = localStorage.getItem('userRole');
      const isExplicitLoggedOut = sessionStorage.getItem('loggedOut') === 'true';

      if (!isExplicitLoggedOut && (isLoggedIn || isStandalone)) {
        const target = userRole === 'super_admin' ? '/superadmin/owners' : (userRole === 'team_member' || userRole === 'pg_owner') ? '/pgowner/dashboard' : userRole === 'tenant' ? '/tenant' : '/pgowner/dashboard';
        router.replace(target);
      }
    }
  }, [router]);

  // Mouse Parallax 3D Glass Tilt Effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-400, 400], [5, -5]), { stiffness: 150, damping: 22 });
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-5, 5]), { stiffness: 150, damping: 22 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const [logoUrl, setLogoUrl] = useState(initialSettings?.logoUrl || '/himalaya_logo_premium.png');
  const [siteName, setSiteName] = useState(initialSettings?.siteName || 'A1 Hostels');
  const [selectedTransition, setSelectedTransition] = useState(initialSettings?.selectedTransition || 'gradient_depixelate');
  const [slideDurationSeconds, setSlideDurationSeconds] = useState(initialSettings?.slideDurationSeconds ?? 1);
  const [headerOutlineColor, setHeaderOutlineColor] = useState(initialSettings?.headerOutlineColor || 'rgba(217, 119, 6, 0.3)');
  const [headerOutlineThickness, setHeaderOutlineThickness] = useState(initialSettings?.headerOutlineThickness ?? 2);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(
    initialSettings?.slides?.length > 0 ? initialSettings.slides : DEFAULT_SLIDES
  );
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(true); // SSR makes this true instantly

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const [hostels, setHostels] = useState<PublicHostel[]>(initialHostels || []);
  const [hostelsLoading, setHostelsLoading] = useState(false); // SSR data is already here
  const [hostelCarouselIdx, setHostelCarouselIdx] = useState<Record<string, number>>({});
  const [facilitiesOpenId, setFacilitiesOpenId] = useState<string | null>(null);

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const loadSettings = async () => {
    const res = await getLandingSettings();
    if (res.success && res.data) {
      if (res.data.logoUrl) setLogoUrl(res.data.logoUrl);
      if (res.data.siteName) setSiteName(res.data.siteName);
      if (res.data.selectedTransition) setSelectedTransition(res.data.selectedTransition);
      if (res.data.slideDurationSeconds !== undefined) setSlideDurationSeconds(res.data.slideDurationSeconds);
      if (res.data.headerOutlineColor) setHeaderOutlineColor(res.data.headerOutlineColor);
      if (res.data.headerOutlineThickness !== undefined) setHeaderOutlineThickness(res.data.headerOutlineThickness);
      if (res.data.slides && res.data.slides.length > 0) {
        const nextSlides = res.data.slides;
        const newSlidesJson = JSON.stringify(nextSlides);
        setSlides((prev) => {
          if (JSON.stringify(prev) === newSlidesJson) return prev;
          return nextSlides;
        });
      } else {
        setSlides(prev => prev.length === 0 ? DEFAULT_SLIDES : prev);
      }
    } else {
      setSlides(prev => prev.length === 0 ? DEFAULT_SLIDES : prev);
    }
    setIsSettingsLoaded(true);
  };

  const loadHostels = async () => {
    try {
      const res = await getPublicHostels();
      if (res.success && res.data && res.data.length > 0) {
        setHostels(res.data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!initialSettings) {
      loadSettings();
    }
    if (!initialHostels || initialHostels.length === 0) {
      loadHostels();
    }
    // Smart polling when active + instant focus re-sync (eliminates CPU scroll stutter)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadSettings();
        loadHostels();
      }
    }, 30000);
    const handleFocus = () => {
      loadSettings();
      loadHostels();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [initialSettings, initialHostels]);

  // Sort initial hostels by GPS asynchronously
  useEffect(() => {
    if (initialHostels && initialHostels.length > 0 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const sorted = [...initialHostels].map(h => ({
            ...h,
            distanceKm: (h.lat && h.lng) ? haversineKm(latitude, longitude, h.lat, h.lng) : undefined
          })).sort((a, b) => {
            if (a.distanceKm !== undefined && b.distanceKm !== undefined) return a.distanceKm - b.distanceKm;
            if (a.distanceKm !== undefined) return -1;
            if (b.distanceKm !== undefined) return 1;
            return 0;
          });
          setHostels(sorted);
        },
        (err) => {
          console.warn("Geolocation sorting skipped:", err.message);
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    }
  }, [initialHostels]);

  // Auto-advance hostel image carousels every 3.5s
  useEffect(() => {
    if (hostels.length === 0) return;
    const t = setInterval(() => {
      setHostelCarouselIdx(prev => {
        const next = { ...prev };
        hostels.forEach(h => {
          const imgList = (h.images && h.images.length > 0) ? h.images : (h.imageUrl ? [h.imageUrl] : []);
          if (imgList.length > 1) {
            const cur = next[h.id] ?? 0;
            next[h.id] = (cur + 1) % imgList.length;
          }
        });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [hostels]);

  // Auto-play Slideshow - DYNAMIC USER-CONFIGURED PAUSE DURATION!
  useEffect(() => {
    if (slides.length <= 1) return;
    const durationMs = Math.max(1, slideDurationSeconds) * 1000;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, durationMs);
    return () => clearInterval(interval);
  }, [slides.length, slideDurationSeconds]);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const isExplicitLoggedOut = sessionStorage.getItem('loggedOut') === 'true';
      const cachedRole = localStorage.getItem('userRole');

      if (isExplicitLoggedOut) {
        sessionStorage.removeItem('loggedOut');
        return;
      }

      if (isLoggedIn && cachedRole) {
        const target = cachedRole === 'super_admin' ? '/superadmin/owners' : cachedRole === 'pg_owner' ? '/pgowner' : '/tenant';
        router.replace(target);
      }
    }
  }, [router]);

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const activeVariant = getTransitionVariants(selectedTransition);

  return (
    <div 
      className={styles.visionPageContainer} 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave}
      style={{
        ['--header-outline-color' as any]: headerOutlineColor,
        ['--header-outline-thickness' as any]: `${headerOutlineThickness}px`
      }}
    >
      
      {/* Liquid Ambient Silk Background */}
      <div className={styles.silkAmbientBackground}>
        <div className={styles.glowGoldOrb1}></div>
        <div className={styles.glowGoldOrb2}></div>
        <div className={styles.glowPearlOrb}></div>
        <div className={styles.liquidRibbon1}></div>
        <div className={styles.liquidRibbon2}></div>
      </div>

      {/* Original Floating Apple VisionOS Glass Navigation Header */}
      <motion.header 
        className={`${styles.visionHeader} ${isSideMenuOpen ? styles.visionHeaderOpen : ''}`}
        style={{
          border: `${headerOutlineThickness}px solid ${headerOutlineColor}`,
          boxShadow: `0 10px 28px rgba(0, 0, 0, 0.08), 0 0 14px ${headerOutlineColor}`
        }}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.headerTopRow}>
          <div className={styles.visionBrand}>
            <div className={styles.officialLogoImg}>
              <img 
                src={logoUrl || '/himalaya_logo_premium.png'} 
                alt="Logo" 
                loading="eager"
                fetchPriority="high"
                decoding="async"
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
            <div className={styles.brandTitleColumn}>
              <span className={styles.brandTitleText}>{siteName || 'A1 HOSTELS'}</span>
              <span className={styles.brandSubtitleText}>SINCE 2018 • PREMIUM PG & HOSTEL LIVING</span>
            </div>
          </div>

          <div className={styles.headerActionGroup}>
            <motion.button 
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsSideMenuOpen(!isSideMenuOpen)}
              className={styles.visionMenuTriggerBtn}
              type="button"
              aria-label="Toggle Menu"
            >
              {isSideMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Downward Expanding Menu Panel */}
        <AnimatePresence>
          {isSideMenuOpen && (
            <motion.div 
              className={styles.expandedMenuPanel}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.expandedMenuDivider} />
              <nav className={styles.expandedMenuNav}>
                <a 
                  href="#" 
                  className={styles.expandedMenuItem}
                  onClick={(e) => { e.preventDefault(); setIsSideMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <div className={styles.expandedItemIconBox}><Home size={18} /></div>
                  <div className={styles.expandedItemTextGroup}>
                    <span className={styles.expandedItemTitle}>Home</span>
                    <span className={styles.expandedItemDesc}>Return to top landing showcase</span>
                  </div>
                </a>
                <a 
                  href="/explore" 
                  className={styles.expandedMenuItem}
                  onClick={(e) => { e.preventDefault(); setIsSideMenuOpen(false); router.push('/explore'); }}
                >
                  <div className={styles.expandedItemIconBox}><Bed size={18} /></div>
                  <div className={styles.expandedItemTextGroup}>
                    <span className={styles.expandedItemTitle}>Explore Hostels</span>
                    <span className={styles.expandedItemDesc}>Browse available luxury PG & hostels</span>
                  </div>
                </a>
                <a 
                  href="/login" 
                  className={styles.expandedMenuItem}
                  onClick={(e) => { e.preventDefault(); setIsSideMenuOpen(false); router.push('/login'); }}
                >
                  <div className={styles.expandedItemIconBox}><User size={18} /></div>
                  <div className={styles.expandedItemTextGroup}>
                    <span className={styles.expandedItemTitle}>Resident Login</span>
                    <span className={styles.expandedItemDesc}>Access resident portal & dues</span>
                  </div>
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hero Section with Managed Image Slideshow & Persistent Glass Context Box */}
      <main className={styles.visionHeroSection}>
        
        {/* HERO SLIDESHOW CONTAINER */}
        <motion.div 
          className={styles.slideshowContainer} 
          style={{ perspective: '1200px', cursor: 'grab' }}
          whileTap={{ cursor: 'grabbing' }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(event, info) => {
            const swipeThreshold = 50;
            if (info.offset.x < -swipeThreshold) {
              handleNextSlide();
            } else if (info.offset.x > swipeThreshold) {
              handlePrevSlide();
            }
          }}
        >
          
          {/* Dynamic Real-Time Animated Slide Images */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div 
              key={`slide-${selectedTransition}-${currentSlideIndex}`}
              className={styles.slideFrame}
              style={{ transformStyle: 'preserve-3d', willChange: 'transform, filter, opacity' }}
              initial={activeVariant.initial}
              animate={activeVariant.animate}
              exit={activeVariant.exit}
              transition={activeVariant.transition}
            >
              {slides.length > 0 && (
                <motion.img 
                  src={slides[currentSlideIndex]?.imageUrl} 
                  alt={slides[currentSlideIndex]?.title || siteName} 
                  className={styles.slideImg}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  initial={activeVariant.initial}
                  animate={activeVariant.animate}
                  exit={activeVariant.exit}
                  transition={activeVariant.transition}
                />
              )}
              <div className={styles.slideDarkOverlay}></div>
              
              {/* Mosaic Pixel Overlay for pixelate transitions */}
              {selectedTransition.includes('pixelate') && (
                <motion.div 
                  className={styles.pixelGridOverlay}
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0.8 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          </AnimatePresence>
 
          {/* Slideshow Controls (Only Dots Indicator) */}
          {slides.length > 1 && (
            <div className={styles.slideIndicators}>
              {slides.map((slide, idx) => (
                <div 
                  key={slide.id}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`${styles.slideDot} ${idx === currentSlideIndex ? styles.slideDotActive : ''}`}
                ></div>
              ))}
            </div>
          )}

          {/* Floating Resident Portal Login Pill at the marked place */}
          <div className={styles.floatingSliderLoginContainer}>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/login')}
              className={styles.floatingSliderLoginBtn}
              type="button"
            >
              <LogIn size={16} />
              <span>Resident Portal Login</span>
            </motion.button>
          </div>
        </motion.div>

        {/* PERSISTENT LIQUID GLASS CONTEXT CARD (OUTSIDE AnimatePresence) */}
        <motion.div 
          className={styles.heroContextCard}
          style={{ rotateX, rotateY }}
          initial={false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }}
        >
          {/* Animated Liquid Background Blobs inside the card under blur */}
          <div className={styles.liquidCardBlob1}></div>
          <div className={styles.liquidCardBlob2}></div>

          <div className={styles.liquidShimmerOverlay}></div>

          <div className={styles.contextBadge}>
            <Sparkles size={14} className={styles.badgeGoldSparkle} />
            <span>SINCE 2018 • PREMIUM PG & HOSTEL LIVING</span>
          </div>

          <h1 className={styles.contextTitle}>
            {siteName}
          </h1>

          <p className={styles.contextText}>
            Redefining luxury, safety, and comfort in PG & hostel living at A1 Hostels. Experience curated living spaces equipped with automated room management, high-speed fiber internet, hygienic dining, and 24/7 digital resident support.
          </p>

          <div className={styles.contextCtaRow}>
            <motion.button 
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => router.push('/login')} 
              className={styles.goldPillBtn}
              type="button"
              style={{ padding: '14px 32px', fontSize: '0.98rem' }}
            >
              <span>Sign In to Portal</span>
              <ArrowUpRight size={18} />
              <div className={styles.shimmerEffect}></div>
            </motion.button>
          </div>
        </motion.div>
      </main>

      {/* ═══════════════════════════════════════════════════════
           HOSTEL SHOWCASE SECTION — below hero
          ═══════════════════════════════════════════════════════ */}
      <section id="hostels-showcase" className={styles.hostelSection}>
        <div className={styles.hostelSectionInner}>

          {/* Section Header */}
          <div className={styles.hostelSectionHeader}>
            <div className={styles.hostelSectionBadge}>
              <Sparkles size={14} />
              <span>OUR PROPERTIES</span>
            </div>
            <h2 className={styles.hostelSectionTitle}>Discover Our Hostels</h2>
            <p className={styles.hostelSectionSubtitle}>
              Hand-picked premium living spaces designed for students &amp; professionals.
            </p>
          </div>

          {hostelsLoading ? (
            <div className={styles.hostelSkeletonGrid}>
              {[1,2,3].map(i => (
                <div key={i} className={styles.hostelSkeletonCard}>
                  <div className={styles.skeletonImg}></div>
                  <div className={styles.skeletonBody}>
                    <div className={styles.skeletonLine} style={{ width: '65%' }}></div>
                    <div className={styles.skeletonLine} style={{ width: '45%' }}></div>
                    <div className={styles.skeletonLine} style={{ width: '80%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : hostels.length === 0 ? (
            <div className={styles.hostelEmpty}>
              <span className={styles.hostelEmptyIcon}>🏨</span>
              <p>No active hostels listed yet. Check back soon!</p>
            </div>
          ) : (
            <div className={styles.hostelGrid}>
              {hostels.map((hostel, i) => {
                // Build image list: prefer uploaded images[], fall back to imageUrl, and remove empty strings
                const imgList = ((hostel.images && hostel.images.length > 0)
                  ? hostel.images
                  : hostel.imageUrl ? [hostel.imageUrl] : []).filter((img: string) => img && typeof img === 'string' && img.trim() !== '');
                const curIdx = hostelCarouselIdx[hostel.id] ?? 0;

                const prevImg = () => setHostelCarouselIdx(prev => ({ ...prev, [hostel.id]: (curIdx - 1 + imgList.length) % imgList.length }));
                const nextImg = () => setHostelCarouselIdx(prev => ({ ...prev, [hostel.id]: (curIdx + 1) % imgList.length }));

                const isOpen = facilitiesOpenId === hostel.id;

                return (
                  <motion.div
                    key={hostel.id}
                    className={styles.hostelCard}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const }}
                    onClick={() => router.push(`/hostels/${hostel.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* ── IMAGE CAROUSEL ── */}
                    <div
                      className={styles.hostelCardImgWrap}
                      onClick={(e) => {
                        // Let click navigate to details page instead of toggling drawer
                      }}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {imgList.length > 0 ? (
                          <motion.img
                            key={curIdx}
                            src={imgList[curIdx]}
                            alt={hostel.name}
                            className={styles.hostelCardImg}
                            initial={{ opacity: 0, scale: 1.06, x: 30 }}
                            animate={{ opacity: 1, scale: 1,    x: 0  }}
                            exit={{    opacity: 0, scale: 0.97, x: -30 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={(_, info) => {
                              if (info.offset.x < -50) nextImg();
                              else if (info.offset.x > 50) prevImg();
                            }}
                            style={{ cursor: 'grab', userSelect: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                          />
                        ) : (
                          <motion.div key="placeholder" className={styles.hostelCardImgPlaceholder} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                            <span style={{ fontSize: '3rem' }}>🏠</span>
                            <span style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '8px', fontWeight: 600 }}>Add images from PG Owner portal</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Carousel nav arrows */}
                      {imgList.length > 1 && (
                        <>
                          <button className={styles.carouselPrev} onClick={e => { e.stopPropagation(); prevImg(); }} type="button">‹</button>
                          <button className={styles.carouselNext} onClick={e => { e.stopPropagation(); nextImg(); }} type="button">›</button>
                          <div className={styles.carouselDots}>
                            {imgList.map((_: string, di: number) => (
                              <span
                                key={di}
                                className={di === curIdx ? styles.carouselDotActive : styles.carouselDot}
                                onClick={e => { e.stopPropagation(); setHostelCarouselIdx(prev => ({ ...prev, [hostel.id]: di })); }}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Distance badge */}
                      {hostel.distanceKm !== undefined && (
                        <div className={styles.hostelDistBadge}>
                          📍 {hostel.distanceKm < 1 ? `${Math.round(hostel.distanceKm * 1000)}m` : `${hostel.distanceKm.toFixed(1)}km`} away
                        </div>
                      )}

                      {/* Gender badge */}
                      {hostel.gender && (
                        <div className={styles.hostelGenderBadge}>
                          {hostel.gender.toLowerCase().includes('girl') || hostel.gender.toLowerCase().includes('female')
                            ? '👩 Girls Only'
                            : hostel.gender.toLowerCase().includes('boy') || hostel.gender.toLowerCase().includes('male')
                            ? '👦 Boys Only'
                            : hostel.gender}
                        </div>
                      )}

                      {/* Tap hint */}
                      <div className={styles.hostelTapHint}>👆 View Details &amp; Facilities</div>
                    </div>

                    {/* ── CARD BODY ── */}
                    <div className={styles.hostelCardBody}>
                      <h3 className={styles.hostelCardName}>{hostel.name}</h3>
                      {hostel.address && (
                        <p className={styles.hostelCardAddress}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          {hostel.address}
                        </p>
                      )}

                      {/* ── ACTION BUTTONS — always visible ── */}
                      <div className={styles.hostelActionRow}>
                        {/* Get Directions: lat/lng → Google Maps dir, OR stored Maps link, OR Maps search */}
                        <a
                          href={
                            hostel.lat && hostel.lng
                              ? `https://www.google.com/maps/dir/?api=1&destination=${hostel.lat},${hostel.lng}`
                              : hostel.locationLink
                              ? hostel.locationLink
                              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((hostel.name || '') + ' ' + (hostel.address || ''))}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.hostelActionBtn}
                          style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', flex: 1 }}
                          onClick={e => e.stopPropagation()}
                        >
                          🗺️ Get Directions
                        </a>

                        {/* Call */}
                        {hostel.phone ? (
                          <a
                            href={`tel:${hostel.phone}`}
                            className={styles.hostelActionBtn}
                            style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                            onClick={e => e.stopPropagation()}
                          >
                            📞 Call
                          </a>
                        ) : null}

                        {/* View Facilities */}
                        <motion.button
                          className={styles.hostelActionBtn}
                          style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FFEDD5', fontWeight: 600, flex: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/hostels/${hostel.id}`);
                          }}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                        >
                          👁️ View Facilities
                        </motion.button>
                      </div>

                    </div>

                    {/* Hover shimmer */}
                    <div className={styles.hostelCardShimmer}></div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>


      {/* 7-Star VisionOS Footer */}
      <footer id="footer-contact" className={styles.visionFooter}>
        <div className={styles.footerGlassPanel}>
          <div className={styles.footerLogoRow}>
            <img 
              src={logoUrl} 
              alt={siteName} 
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <span className={styles.footerBrandText}>{siteName}</span>
          </div>

          <p className={styles.footerTagline}>Alpine Luxury Defined. Powered by Raliven Innovations.</p>

          <div className={styles.footerLinkRow}>
            <span onClick={() => router.push('/login')} className={styles.footerLink}>Portal Sign In</span>
          </div>

          <div className={styles.footerDivider}></div>
          <p className={styles.copyrightText}>© 2026 {siteName} & Raliven Innovations. All peaks reserved.</p>
        </div>
      </footer>

    </div>
  );
}
