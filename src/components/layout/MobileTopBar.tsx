'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Calculator } from 'lucide-react';

export function MobileTopBar() {
  const { language, setLanguage } = useLanguage();
  const { isAdmin } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[var(--paper-light)] px-3 py-2.5 md:hidden overflow-hidden">
      <Link href="/dashboard" className="flex items-center gap-1.5 shrink-0">
        <div className="relative h-5 w-5 shrink-0">
          <Image src="/logo.png" alt="DiamondMass" fill className="object-contain" priority />
        </div>
        <span className="text-xs font-black tracking-wider text-[var(--brown-dark)] hidden min-[390px]:inline">
          DIAMONDMASS
        </span>
        <span className="text-xs font-black tracking-wider text-[var(--brown-dark)] min-[390px]:hidden">
          DM
        </span>
      </Link>

      <div className="flex items-center gap-1 shrink-0 flex-nowrap">
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black border transition-colors whitespace-nowrap shrink-0 ${
              pathname === '/admin'
                ? 'bg-[var(--brown-dark)] text-white border-[var(--brown-dark)] shadow-sm'
                : 'bg-[var(--cream)] text-[var(--brown-dark)] border-[var(--border)] hover:bg-[var(--cream-soft)]'
            }`}
          >
            <ShieldCheck size={11} className={pathname === '/admin' ? 'text-amber-300' : 'text-[var(--brown)]'} />
            <span>Admin</span>
          </Link>
        )}

        <a
          href="/tdee.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full bg-[var(--cream)] px-2 py-0.5 text-[10px] font-bold text-[var(--brown-dark)] hover:bg-[var(--cream-soft)] border border-[var(--border)] transition-colors whitespace-nowrap shrink-0"
        >
          <Calculator size={11} className="text-[var(--brown)]" />
          <span>TDEE</span>
        </a>

        <a
          href="https://diamondmasszerotomassebook.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full bg-[var(--cream)] px-2 py-0.5 text-[10px] font-bold text-[var(--brown-dark)] hover:bg-[var(--cream-soft)] border border-[var(--border)] transition-colors whitespace-nowrap shrink-0"
        >
          <span>E-Book</span>
        </a>

        <div className="flex overflow-hidden rounded-full border border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={() => setLanguage('th')}
            className={`px-1.5 py-0.5 text-[9px] font-black transition-colors ${
              language === 'th' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)] bg-[var(--paper-light)]'
            }`}
          >
            TH
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-1.5 py-0.5 text-[9px] font-black transition-colors ${
              language === 'en' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)] bg-[var(--paper-light)]'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

