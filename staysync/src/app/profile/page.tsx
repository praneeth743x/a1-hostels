"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('userRole') || 'tenant';
    if (role === 'team_member') {
      router.replace('/teammember/profile');
    } else if (role === 'pg_owner') {
      router.replace('/pgowner/profile');
    } else if (role === 'super_admin') {
      router.replace('/superadmin');
    } else {
      router.replace('/tenant/profile');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
      <Loader2 className="animate-spin text-blue-500" size={36} />
    </div>
  );
}
