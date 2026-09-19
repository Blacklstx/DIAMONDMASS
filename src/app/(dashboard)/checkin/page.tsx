'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function CheckinRedirectPage() {
  const { currentWeek } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/checkin/${currentWeek || 1}`);
  }, [currentWeek, router]);

  return (
    <div className="flex h-48 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brown)]" />
    </div>
  );
}

