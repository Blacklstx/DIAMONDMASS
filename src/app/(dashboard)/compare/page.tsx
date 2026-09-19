'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';

export default function ComparePage() {
  const { user, profile, checkins, currentWeek } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [fromWeek, setFromWeek] = useState(1);
  const [toWeek, setToWeek] = useState(Math.max(1, currentWeek));
  const [view, setView] = useState<'front' | 'left' | 'right' | 'back'>('front');
  const [hideNumbers, setHideNumbers] = useState(false);

  const [fromPhotoUrl, setFromPhotoUrl] = useState<string | null>(null);
  const [toPhotoUrl, setToPhotoUrl] = useState<string | null>(null);

  // Load photos for selected fromWeek & toWeek
  useEffect(() => {
    if (!user) return;

    async function loadComparePhotos() {
      const fromPad = String(fromWeek).padStart(2, '0');
      const toPad = String(toWeek).padStart(2, '0');

      const { data: fData } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(`${user?.id}/week-${fromPad}/${view}.jpg`, 3600);
      setFromPhotoUrl(fData?.signedUrl || null);

      const { data: tData } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(`${user?.id}/week-${toPad}/${view}.jpg`, 3600);
      setToPhotoUrl(tData?.signedUrl || null);
    }

    loadComparePhotos();
  }, [user, fromWeek, toWeek, view]);

  // Compute metrics for from & to
  const getWeekAvgWeight = (w: number) => {
    const c = checkins.find((x) => x.week === w);
    const days = c?.data?.days;
    if (days) {
      const arr = Object.values(days)
        .map((d) => d?.weight)
        .filter((v): v is number => v !== null && v !== undefined);
      if (arr.length > 0) {
        return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
      }
    }
    if (w === 1 && profile?.start_weight) return profile.start_weight;
    return null;
  };

  const getWeekMetric = (w: number, field: 'waist' | 'hips' | 'chest' | 'arm' | 'thigh') => {
    const c = checkins.find((x) => x.week === w);
    if (c?.data?.[field] !== undefined && c.data[field] !== null) {
      return c.data[field];
    }
    if (w === 1 && field === 'waist' && profile?.start_waist) {
      return profile.start_waist;
    }
    return null;
  };

  const fromWeight = getWeekAvgWeight(fromWeek);
  const toWeight = getWeekAvgWeight(toWeek);
  const weightDelta =
    fromWeight !== null && toWeight !== null
      ? Math.round((toWeight - fromWeight) * 10) / 10
      : null;

  const fromWaist = getWeekMetric(fromWeek, 'waist');
  const toWaist = getWeekMetric(toWeek, 'waist');
  const waistDelta =
    fromWaist !== null && toWaist !== null
      ? Math.round((toWaist - fromWaist) * 10) / 10
      : null;

  const fromHips = getWeekMetric(fromWeek, 'hips');
  const toHips = getWeekMetric(toWeek, 'hips');
  const hipsDelta =
    fromHips !== null && toHips !== null
      ? Math.round((toHips - fromHips) * 10) / 10
      : null;

  const fromChest = getWeekMetric(fromWeek, 'chest');
  const toChest = getWeekMetric(toWeek, 'chest');
  const chestDelta =
    fromChest !== null && toChest !== null
      ? Math.round((toChest - fromChest) * 10) / 10
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--brown-dark)]">
          {t('compare_title')}
        </h1>
        <p className="text-xs font-bold text-[var(--muted)]">
          {t('compare_sub')}
        </p>
      </div>

      {/* Control Bar */}
      <div className="card grid grid-cols-2 gap-3 sm:grid-cols-4 items-center">
        <div className="field">
          <label>{t('fromWeek')}</label>
          <select
            value={fromWeek}
            onChange={(e) => setFromWeek(Number(e.target.value))}
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {t('weekOpt', w)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('toWeek')}</label>
          <select
            value={toWeek}
            onChange={(e) => setToWeek(Number(e.target.value))}
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {t('weekOpt', w)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('view')}</label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
          >
            <option value="front">{t('ph_front')}</option>
            <option value="left">{t('ph_left')}</option>
            <option value="right">{t('ph_right')}</option>
            <option value="back">{t('ph_back')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="hideNums"
            checked={hideNumbers}
            onChange={(e) => setHideNumbers(e.target.checked)}
            className="h-4 w-4 accent-[var(--brown)]"
          />
          <label htmlFor="hideNums" className="text-xs font-bold text-[var(--brown-dark)] cursor-pointer">
            {t('hideNumbers')}
          </label>
        </div>
      </div>

      {/* Side-by-Side Photos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card text-center">
          <div className="mb-2 text-xs font-black text-[var(--brown-dark)]">
            {t('weekOpt', fromWeek)}
          </div>
          <div className="relative mx-auto aspect-3/4 max-w-sm overflow-hidden rounded-xl bg-[var(--cream-soft)]">
            {fromPhotoUrl ? (
              <img
                src={fromPhotoUrl}
                alt={`Week ${fromWeek}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--muted)]">
                No photo for Week {fromWeek}
              </div>
            )}
          </div>
          {!hideNumbers && (
            <div className="mt-2 text-xs font-bold text-[var(--muted)]">
              {fromWeight ? `${fromWeight} kg` : '—'} • {fromWaist ? `${fromWaist} cm` : '—'}
            </div>
          )}
        </div>

        <div className="card text-center">
          <div className="mb-2 text-xs font-black text-[var(--brown-dark)]">
            {t('weekOpt', toWeek)}
          </div>
          <div className="relative mx-auto aspect-3/4 max-w-sm overflow-hidden rounded-xl bg-[var(--cream-soft)]">
            {toPhotoUrl ? (
              <img
                src={toPhotoUrl}
                alt={`Week ${toWeek}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--muted)]">
                No photo for Week {toWeek}
              </div>
            )}
          </div>
          {!hideNumbers && (
            <div className="mt-2 text-xs font-bold text-[var(--muted)]">
              {toWeight ? `${toWeight} kg` : '—'} • {toWaist ? `${toWaist} cm` : '—'}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Comparison Table */}
      {!hideNumbers && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)] font-black">
                <th className="pb-2">METRIC</th>
                <th className="pb-2">WEEK {fromWeek}</th>
                <th className="pb-2">WEEK {toWeek}</th>
                <th className="pb-2">CHANGE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-bold text-[var(--text)]">
              <tr>
                <td className="py-2.5 font-extrabold text-[var(--brown-dark)]">{t('weightLbl')}</td>
                <td>{fromWeight !== null ? `${fromWeight} kg` : '—'}</td>
                <td>{toWeight !== null ? `${toWeight} kg` : '—'}</td>
                <td className={weightDelta && weightDelta < 0 ? 'text-emerald-700' : 'text-amber-800'}>
                  {weightDelta !== null ? `${weightDelta > 0 ? `+${weightDelta}` : weightDelta} kg` : '—'}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-extrabold text-[var(--brown-dark)]">{t('waistLbl')}</td>
                <td>{fromWaist !== null ? `${fromWaist} cm` : '—'}</td>
                <td>{toWaist !== null ? `${toWaist} cm` : '—'}</td>
                <td className={waistDelta && waistDelta < 0 ? 'text-emerald-700' : 'text-amber-800'}>
                  {waistDelta !== null ? `${waistDelta > 0 ? `+${waistDelta}` : waistDelta} cm` : '—'}
                </td>
              </tr>
              {fromHips !== null || toHips !== null ? (
                <tr>
                  <td className="py-2.5 font-extrabold text-[var(--brown-dark)]">{t('m_hip')}</td>
                  <td>{fromHips !== null ? `${fromHips} cm` : '—'}</td>
                  <td>{toHips !== null ? `${toHips} cm` : '—'}</td>
                  <td>{hipsDelta !== null ? `${hipsDelta > 0 ? `+${hipsDelta}` : hipsDelta} cm` : '—'}</td>
                </tr>
              ) : null}
              {fromChest !== null || toChest !== null ? (
                <tr>
                  <td className="py-2.5 font-extrabold text-[var(--brown-dark)]">{t('m_chest')}</td>
                  <td>{fromChest !== null ? `${fromChest} cm` : '—'}</td>
                  <td>{toChest !== null ? `${toChest} cm` : '—'}</td>
                  <td>{chestDelta !== null ? `${chestDelta > 0 ? `+${chestDelta}` : chestDelta} cm` : '—'}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

