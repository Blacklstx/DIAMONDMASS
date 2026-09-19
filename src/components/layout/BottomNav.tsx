'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  Camera,
  GitCompare,
  User,
  ShieldCheck,
} from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { currentWeek, isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: t('bn_dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: t('bn_checkin'), href: `/checkin/${currentWeek}`, icon: CheckSquare },
    { id: 'photos', label: t('bn_photos'), href: '/photos', icon: Camera },
    { id: 'compare', label: t('bn_compare'), href: '/compare', icon: GitCompare },
    { id: 'profile', label: t('bn_profile'), href: '/profile', icon: User },
    ...(isAdmin ? [{ id: 'admin', label: t('bn_admin'), href: '/admin', icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[var(--border)] bg-[var(--paper-light)] py-1.5 px-1 md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.id === 'checkin'
            ? pathname.startsWith('/checkin')
            : pathname === item.href;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-colors ${
              isActive ? 'text-[var(--brown-dark)]' : 'text-[var(--muted)]'
            }`}
          >
            <Icon size={18} />
            <span>{item.label}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? 'bg-[var(--brown)]' : 'bg-transparent'
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

