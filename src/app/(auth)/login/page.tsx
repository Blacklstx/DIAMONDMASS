'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message || t('auth_error_generic'));
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setErrorMsg(t('auth_error_generic'));
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setErrorMsg(t('auth_error_mismatch'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message || t('auth_error_generic'));
        setLoading(false);
        return;
      }

      setSuccessMsg(t('auth_signup_success'));
      setLoading(false);
    } catch {
      setErrorMsg(t('auth_error_generic'));
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setErrorMsg(error.message || t('auth_error_generic'));
      } else {
        setSuccessMsg(t('auth_reset_sent'));
      }
    } catch {
      setErrorMsg(t('auth_error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-4 py-12">
      {/* Language Toggle */}
      <div className="mb-6 flex overflow-hidden rounded-full border border-[var(--border)] bg-[var(--paper-light)]">
        <button
          type="button"
          onClick={() => setLanguage('th')}
          className={`px-3 py-1 text-xs font-bold transition-colors ${
            language === 'th' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)]'
          }`}
        >
          TH
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 text-xs font-bold transition-colors ${
            language === 'en' ? 'bg-[var(--brown-dark)] text-white' : 'text-[var(--muted)]'
          }`}
        >
          EN
        </button>
      </div>

      <div className="w-full max-w-md card">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-2 h-14 w-14">
            <Image src="/logo.png" alt="DiamondMass Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-extrabold tracking-wider text-[var(--brown-dark)]">DIAMONDMASS</h1>
          <p className="text-xs text-[var(--muted)]">
            {t('auth_tagline1')} — {t('auth_tagline2')}
          </p>
        </div>

        {tab !== 'forgot' && (
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-extrabold transition-all ${
                tab === 'login'
                  ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white'
                  : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
              }`}
            >
              {t('auth_login_tab')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-extrabold transition-all ${
                tab === 'signup'
                  ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white'
                  : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
              }`}
            >
              {t('auth_signup_tab')}
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
            {successMsg}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="field">
              <label>{t('auth_email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@example.com"
              />
            </div>
            <div className="field">
              <label>{t('auth_password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="btn primary w-full mt-2">
              {loading ? '...' : t('auth_login_btn')}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setTab('forgot');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs text-[var(--brown)] underline cursor-pointer hover:opacity-80"
              >
                {t('auth_forgot')}
              </button>
            </div>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="field">
              <label>{t('auth_email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@example.com"
              />
            </div>
            <div className="field">
              <label>{t('auth_password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="field">
              <label>{t('auth_confirmPassword')}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="btn primary w-full mt-2">
              {loading ? '...' : t('auth_signup_btn')}
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="field">
              <label>{t('auth_email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@example.com"
              />
            </div>

            <button type="submit" disabled={loading} className="btn primary w-full mt-2">
              {loading ? '...' : t('auth_forgot_btn')}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs text-[var(--brown)] underline cursor-pointer hover:opacity-80"
              >
                {t('auth_back_to_login')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

