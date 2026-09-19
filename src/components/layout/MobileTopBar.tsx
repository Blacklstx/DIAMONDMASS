'use client';

import React from 'react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';

export function MobileTopBar() {
  const { language, setLanguage } = useLanguage();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[var(--paper-light)] px-4 py-3 md:hidden">
      <div className="flex items-center gap-2">
        <div className="relative h-5 w-5">
          <Image src="/logo.png" alt="DiamondMass" fill className="object-contain" />
        </div>
        <span className="text-xs font-extrabold tracking-wider text-[var(--brown-dark)]">
          DIAMONDMASS
        </span>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="https://diamondmasszerotomassebook.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full bg-[var(--cream)] px-2.5 py-1 text-[10px] font-bold text-[var(--brown-dark)] hover:bg-[var(--cream-soft)] border border-[var(--border)] transition-colors"
        >
          <span>E-Book</span>
        </a>

        <div className="flex overflow-hidden rounded-full border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setLanguage('th')}
            className={`px-2.5 py-0.5 text-[10px] font-extrabold transition-colors ${
              language === 'th' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)]'
            }`}
          >
            TH
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-0.5 text-[10px] font-extrabold transition-colors ${
              language === 'en' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)]'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

