'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { CoachReport } from '@/types/database';
import { ShieldAlert, CheckCircle, Award } from 'lucide-react';

export default function CoachReportPage() {
  const params = useParams();
  const token = params?.token as string;
  const { t } = useLanguage();
  const supabase = createClient();

  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_coach_report', {
          p_token: token,
        });

        if (rpcErr) throw rpcErr;
        if (!data || !data.profile) {
          setError('Invalid or expired coach link.');
          setLoading(false);
          return;
        }

        setReport(data as CoachReport);
      } catch (err: any) {
        console.error(err);
        setError('Could not load coach report.');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--border)] border-t-[var(--brown)]" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] p-4">
        <div className="card max-w-md text-center py-10">
          <ShieldAlert size={40} className="mx-auto text-amber-700 mb-3" />
          <h1 className="text-base font-black text-[var(--brown-dark)] mb-2">
            Access Unavailable
          </h1>
          <p className="text-xs text-[var(--muted)]">
            {error || 'This coach link is inactive or has been regenerated.'}
          </p>
        </div>
      </div>
    );
  }

  const profile = report.profile;
  const checkins = report.checkins || [];
  const weeks = Array.from({ length: 16 }, (_, i) => i + 1);

  const weightSeries = weeks.map((w) => {
    const c = checkins.find((x) => x.week === w);
    const days = c?.days;
    if (days) {
      const weights = Object.values(days)
        .map((d) => d?.weight)
        .filter((v): v is number => v !== null && v !== undefined);
      if (weights.length > 0) {
        return Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10;
      }
    }
    return null;
  });

  const waistSeries = weeks.map((w) => {
    const c = checkins.find((x) => x.week === w);
    return c?.waist ?? null;
  });

  const validWeights = weightSeries.filter((v): v is number => v !== null);
  const currentWeight = validWeights.length > 0 ? validWeights[validWeights.length - 1] : profile.start_weight;
  const weightChange = currentWeight !== null && profile.start_weight !== null
    ? Math.round((currentWeight - profile.start_weight) * 10) / 10
    : 0;

  return (
    <div className="min-h-screen bg-[var(--paper)] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Read-Only Coach Banner */}
        <div className="rounded-xl bg-[var(--brown-dark)] px-4 py-3 text-xs font-black text-[var(--paper-light)] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Award size={16} />
            <span>{t('coach_readonly')}</span>
          </div>
          <span className="text-[10px] tracking-widest text-[var(--beige)] uppercase">
            DIAMONDMASS
          </span>
        </div>

        {/* Trainee Header */}
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <Image src="/logo.png" alt="DiamondMass" fill className="object-contain" priority />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--brown-dark)]">
                {profile.name}&apos;s Progress
              </h1>
              <p className="text-xs text-[var(--muted)] font-bold">
                Goal: {profile.goal?.toUpperCase()} • Started:{' '}
                {profile.start_date || '—'}
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-center">
            <div>
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase">START WEIGHT</div>
              <div className="text-base font-black text-[var(--brown-dark)]">
                {profile.start_weight} kg
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase">CURRENT</div>
              <div className="text-base font-black text-[var(--brown-dark)]">
                {currentWeight} kg
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase">CHANGE</div>
              <div className={`text-base font-black ${weightChange < 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                {weightChange > 0 ? `+${weightChange}` : weightChange} kg
              </div>
            </div>
          </div>
        </div>

        {/* Trend Charts */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TrendChart
            title="Weight Trend (kg)"
            labels={weeks.map((w) => `W${w}`)}
            data={weightSeries}
            unit="kg"
          />
          <TrendChart
            title="Waist Trend (cm)"
            labels={weeks.map((w) => `W${w}`)}
            data={waistSeries}
            unit="cm"
            borderColor="#8C6D4F"
            backgroundColor="rgba(140, 109, 79, 0.08)"
          />
        </div>

        {/* Weekly Checkin Logs & Notes */}
        <div className="card space-y-4">
          <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
            Weekly Notes & Logs
          </h2>

          <div className="space-y-3">
            {checkins.length === 0 ? (
              <p className="text-xs text-[var(--muted)] text-center py-6">
                No check-in entries logged yet.
              </p>
            ) : (
              checkins.map((c) => (
                <div
                  key={c.week}
                  className="rounded-xl border border-[var(--border)] bg-[var(--cream-soft)] p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[var(--brown-dark)]">
                      Week {c.week}
                    </span>
                    <div className="text-[11px] font-bold text-[var(--muted)] flex gap-3">
                      <span>Waist: {c.waist ? `${c.waist} cm` : '—'}</span>
                      <span>Steps: {c.steps ? `${c.steps}` : '—'}</span>
                    </div>
                  </div>

                  {c.notes ? (
                    <p className="text-xs text-[var(--brown-dark)] bg-white/70 rounded-lg p-2.5 italic">
                      &ldquo;{c.notes}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--muted)] italic">
                      No notes written for this week.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

