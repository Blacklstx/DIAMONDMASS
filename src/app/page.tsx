'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
    } else if (!profile || !profile.start_weight) {
      router.replace('/onboarding');
    } else {
      router.replace('/dashboard');
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--paper)]">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--border)] border-t-[var(--brown)]" />
    </div>
  );
}

