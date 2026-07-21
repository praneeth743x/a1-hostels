"use client";

import React, { useEffect, useState, useMemo } from 'react';
import styles from './WeatherBackground.module.css';

type WeatherState = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm';

// Calculate the current lunar phase (0.0 to 1.0)
const getMoonPhase = (date = new Date()) => {
  const LUNAR_MONTH = 29.53058867;
  const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime();
  const diff = date.getTime() - knownNewMoon;
  let phase = (diff / (1000 * 60 * 60 * 24)) % LUNAR_MONTH;
  if (phase < 0) phase += LUNAR_MONTH;
  return phase / LUNAR_MONTH;
};

export const WeatherBackground = () => {
  const [weather, setWeather] = useState<WeatherState>('clear');
  const [isDay, setIsDay] = useState(true);
  const [windSpeed, setWindSpeed] = useState(10); // km/h
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported. Defaulting to clear day.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const data = await res.json();
          if (data && data.current_weather) {
            const { weathercode, is_day, windspeed } = data.current_weather;
            setIsDay(is_day === 1);
            setWindSpeed(windspeed);
            
            // Map WMO code to our states
            if ([0, 1].includes(weathercode)) setWeather('clear');
            else if ([2, 3, 45, 48].includes(weathercode)) setWeather('cloudy');
            else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weathercode)) setWeather('rain');
            else if ([71, 73, 75, 77, 85, 86].includes(weathercode)) setWeather('snow');
            else if ([95, 96, 99].includes(weathercode)) setWeather('storm');
          }
        } catch (e) {
          console.error("Failed to fetch weather", e);
        }
      },
      (error) => {
        console.warn("Geolocation denied or error:", error);
      }
    );
  }, []);

  // Use useMemo to generate stable particles on mount to avoid hydration mismatch
  const { stars, clouds, rains, snows } = useMemo(() => {
    if (!mounted) return { stars: [], clouds: [], rains: [], snows: [] };
    
    const s = Array.from({ length: 50 }).map((_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 70}%`,
      width: `${Math.random() * 3 + 1}px`,
      height: `${Math.random() * 3 + 1}px`,
      animationDelay: `${Math.random() * 3}s`
    }));

    const c = Array.from({ length: 8 }).map((_, i) => ({
      left: `-${Math.random() * 20 + 20}%`,
      top: `${Math.random() * 40}%`,
      width: `${Math.random() * 100 + 100}px`,
      height: '40px',
      animationDuration: `${(Math.random() * 20 + 20) * (20 / Math.max(windSpeed, 5))}s`, // wind affects speed
      animationDelay: `${Math.random() * -40}s` // start midway
    }));

    const r = Array.from({ length: 80 }).map((_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `-${Math.random() * 20}%`,
      animationDuration: `${Math.random() * 0.5 + 0.5}s`,
      animationDelay: `${Math.random() * 2}s`,
      transform: `rotate(${windSpeed > 15 ? 15 : 0}deg)` // wind angle
    }));

    const sn = Array.from({ length: 60 }).map((_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `-${Math.random() * 20}%`,
      width: `${Math.random() * 6 + 2}px`,
      height: `${Math.random() * 6 + 2}px`,
      animationDuration: `${Math.random() * 3 + 3}s`,
      animationDelay: `${Math.random() * 5}s`
    }));

    return { stars: s, clouds: c, rains: r, snows: sn };
  }, [mounted, windSpeed]);

  if (!mounted) return <div className={`${styles.weatherContainer} ${styles.skyClearDay}`} />;

  let bgClass = styles.skyClearDay;
  if (weather === 'clear') bgClass = isDay ? styles.skyClearDay : styles.skyClearNight;
  else if (weather === 'cloudy') bgClass = isDay ? styles.skyCloudyDay : styles.skyCloudyNight;
  else if (weather === 'rain') bgClass = styles.skyRain;
  else if (weather === 'storm') bgClass = styles.skyStorm;
  else if (weather === 'snow') bgClass = styles.skySnow;

  // Calculate moon shadow based on real astronomical phase
  const phase = getMoonPhase();
  let moonShadow = '';
  if (phase <= 0.5) {
    // Waxing (0 to 0.5) -> Shadow grows from right edge to full
    moonShadow = `inset ${-(phase * 2 * 100)}px 0px 0px 0px #F4F6F0`;
  } else {
    // Waning (0.5 to 1.0) -> Shadow shrinks from full to left edge
    moonShadow = `inset ${(1 - phase) * 2 * 100}px 0px 0px 0px #F4F6F0`;
  }

  // Determine lighting class based on time and weather
  let lightingClass = '';
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 7) lightingClass = styles.lightingSunrise;
  else if (hour >= 17 && hour <= 19) lightingClass = styles.lightingSunset;
  else if (!isDay) lightingClass = styles.lightingNight;
  
  if (weather === 'storm' || weather === 'rain') lightingClass = styles.lightingStorm;

  return (
    <div className={styles.weatherContainer}>
      {/* Photorealistic Background Image with Dynamic Lighting Filters */}
      <div className={`${styles.photoBackground} ${lightingClass}`} />

      {/* Sweeping Cloud Shadows */}
      {(weather === 'cloudy' || weather === 'rain' || weather === 'storm') && (
        <div className={styles.cloudShadowOverlay} />
      )}

      {/* Volumetric Fog Base */}
      <div className={`${styles.fogOverlay} ${weather === 'rain' || weather === 'snow' || weather === 'storm' ? styles.fogThick : ''}`} />

      {/* Sun or Moon */}
      {weather !== 'storm' && weather !== 'rain' && weather !== 'snow' && (
        <div 
          className={`${styles.celestialBody} ${isDay ? styles.sun : styles.moon}`} 
          style={!isDay ? { boxShadow: moonShadow } : {}}
        />
      )}

      {/* Stars */}
      {!isDay && weather === 'clear' && stars.map((s, i) => (
        <div key={`star-${i}`} className={styles.star} style={s} />
      ))}

      {/* Clouds */}
      {(weather === 'cloudy' || weather === 'rain' || weather === 'storm' || weather === 'snow') && clouds.map((c, i) => (
        <div 
          key={`cloud-${i}`} 
          className={`${styles.cloud} ${!isDay || weather === 'storm' ? styles.cloudDark : ''}`} 
          style={{...c, animationName: styles.drift}} 
        />
      ))}

      {/* Rain */}
      {(weather === 'rain' || weather === 'storm') && rains.map((r, i) => (
        <div key={`rain-${i}`} className={styles.rainDrop} style={r} />
      ))}

      {/* Snow */}
      {weather === 'snow' && snows.map((s, i) => (
        <div key={`snow-${i}`} className={styles.snowFlake} style={s} />
      ))}

    </div>
  );
};
