'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileTopBar } from '@/components/layout/MobileTopBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuth } from '@/context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--border)] border-t-[var(--brown)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <MobileTopBar />
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-12 max-w-6xl mx-auto w-full">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

