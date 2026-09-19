'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  Camera,
  GitCompare,
  Share2,
  User,
  LogOut,
  ShieldCheck,
  BookOpen,
  ExternalLink,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { profile, currentWeek, logout, isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: t('nav_dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: t('nav_checkin'), href: `/checkin/${currentWeek}`, icon: CheckSquare },
    { id: 'photos', label: t('nav_photos'), href: '/photos', icon: Camera },
    { id: 'compare', label: t('nav_compare'), href: '/compare', icon: GitCompare },
    { id: 'profile', label: t('nav_profile'), href: '/profile', icon: User },
    ...(isAdmin ? [{ id: 'admin', label: t('nav_admin'), href: '/admin', icon: ShieldCheck }] : []),
  ];

  const goalText = profile?.goal === 'bulking' ? t('goal_bulking') : t('goal_cutting');

  return (
    <aside className="sticky top-0 hidden h-screen w-58 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--paper-light)] p-5 md:flex">
      {/* Brand */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative h-6 w-6">
          <Image src="/logo.png" alt="DiamondMass" fill className="object-contain" />
        </div>
        <span className="text-xs font-extrabold tracking-widest text-[var(--brown-dark)]">
          DIAMONDMASS
        </span>
      </div>

      {/* Language Switch */}
      <div className="mb-5 flex w-fit overflow-hidden rounded-full border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setLanguage('th')}
          className={`px-3 py-1 text-[11px] font-extrabold transition-colors ${
            language === 'th' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)] hover:bg-[var(--cream-soft)]'
          }`}
        >
          TH
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 text-[11px] font-extrabold transition-colors ${
            language === 'en' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)] hover:bg-[var(--cream-soft)]'
          }`}
        >
          EN
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col gap-1">
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
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-[var(--brown-dark)] text-[var(--paper-light)]'
                  : 'text-[var(--muted)] hover:bg-[var(--cream-soft)]'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section right above line */}
      <div className="mt-auto pt-4">
        {/* E-Book Link */}
        <a
          href="https://diamondmasszerotomassebook.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--brown-dark)] hover:bg-[var(--cream-soft)] transition-colors group mb-3 border border-[var(--border)] bg-[var(--cream-soft)]/50"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen size={16} className="text-[var(--brown)]" />
            <span>E-Book</span>
          </div>
          <ExternalLink size={13} className="text-[var(--muted)] group-hover:text-[var(--brown-dark)] transition-colors" />
        </a>

        {/* Footer info */}
        <div className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        {isAdmin && !profile?.start_date ? (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 border border-amber-300">
            <ShieldCheck size={13} />
            <span>ADMIN / COACH</span>
          </div>
        ) : (
          <>
            <div className="mb-2 inline-block rounded-full bg-[var(--cream)] px-2.5 py-1 text-[11px] font-bold text-[var(--brown-dark)]">
              {t('week_pill', currentWeek)}
            </div>
            <div className="text-[11px] font-semibold text-[var(--muted)]">
              {profile?.goal ? `${goalText}` : '—'}
            </div>
          </>
        )}
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[var(--brown)] hover:opacity-80 cursor-pointer"
        >
          <LogOut size={13} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  </aside>
  );
}

