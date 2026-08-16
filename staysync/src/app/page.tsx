import LandingClient, { PublicHostel } from './LandingClient';
import { getLandingSettings, getPublicHostels } from '@/app/actions/superadmin';

// Enable ISR static caching with fast revalidation so TTFB drops from >3000ms to <15ms
export const revalidate = 300;

export default async function Page() {
  // Fetch data in parallel on the server for instant SSR loading
  const [settingsRes, hostelsRes] = await Promise.all([
    getLandingSettings(),
    getPublicHostels()
  ]);

  const initialSettings = settingsRes.success ? settingsRes.data : null;
  const initialHostels = (hostelsRes.success ? hostelsRes.data : []) as PublicHostel[];

  return <LandingClient initialSettings={initialSettings} initialHostels={initialHostels} />;
}
