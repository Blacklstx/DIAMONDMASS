'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ArrowRight, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';

export default function DashboardPage() {
  const { profile, checkins, currentWeek, getWeekStatus, isAdmin } = useAuth();
  const { t, language } = useLanguage();

  if (!profile || !profile.start_weight) {
    if (isAdmin) {
      return (
        <div className="card text-center py-10 max-w-lg mx-auto">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
            <ShieldCheck size={30} />
          </div>
          <h2 className="text-lg font-black text-[var(--brown-dark)] mb-2">
            {language === 'th' ? 'แดชบอร์ดผู้ดูแลระบบ (Admin / Coach)' : 'Admin & Coach Dashboard'}
          </h2>
          <p className="text-xs text-[var(--muted)] mb-6 max-w-md mx-auto leading-relaxed">
            {language === 'th'
              ? 'คุณเข้าสู่ระบบในฐานะแอดมิน คุณสามารถเลือกเริ่มบันทึกและติดตามผลของตัวเอง หรือเข้าสู่ระบบจัดการลูกเทรน'
              : 'You are logged in as Admin. You can track your personal fitness progress or manage trainees in the admin dashboard.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/onboarding" className="btn primary small w-full sm:w-auto flex items-center justify-center gap-2">
              <span>{language === 'th' ? 'เริ่มติดตามผลตัวเอง' : 'Start Personal Tracking'}</span>
              <ArrowRight size={14} />
            </Link>
            <Link href="/admin" className="btn secondary small w-full sm:w-auto flex items-center justify-center gap-2">
              <ShieldCheck size={14} />
              <span>{language === 'th' ? 'ไปที่แดชบอร์ดจัดการลูกเทรน' : 'Go to Admin Roster'}</span>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="card text-center py-12">
        <h2 className="text-base font-extrabold text-[var(--brown-dark)] mb-2">
          {t('ob_title')}
        </h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          {t('ob_sub')}
        </p>
        <Link href="/onboarding" className="btn primary small">
          {t('ob_submit')}
        </Link>
      </div>
    );
  }

  // Calculate 16-week series
  const weeks = Array.from({ length: 16 }, (_, i) => i + 1);

  const weightSeries = weeks.map((w) => {
    const c = checkins.find((x) => x.week === w);
    if (!c?.data) return null;
    const days = c.data.days;
    if (days) {
      const weights = Object.values(days)
        .map((d) => d.weight)
        .filter((v): v is number => v !== null && v !== undefined);
      if (weights.length > 0) {
        return Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10;
      }
    }
    return null;
  });

  const waistSeries = weeks.map((w) => {
    const c = checkins.find((x) => x.week === w);
    return c?.data?.waist ?? null;
  });

  const stepsSeries = weeks.map((w) => {
    const c = checkins.find((x) => x.week === w);
    return c?.data?.steps ?? null;
  });

  const cardioSeries = weeks.map((w) => {
    const c = checkins.find((x) => x.week === w);
    return c?.data?.cardio ?? null;
  });

  // Start vs Current calculations
  const startWeight = profile.start_weight;
  const validWeights = weightSeries.filter((v): v is number => v !== null);
  const currentWeight = validWeights.length > 0 ? validWeights[validWeights.length - 1] : startWeight;
  const weightChange =
    currentWeight !== null && currentWeight !== undefined && startWeight !== null && startWeight !== undefined
      ? Math.round((currentWeight - startWeight) * 10) / 10
      : 0;

  const startWaist = profile.start_waist;
  const validWaists = waistSeries.filter((v): v is number => v !== null);
  const currentWaist = validWaists.length > 0 ? validWaists[validWaists.length - 1] : startWaist;
  const waistChange =
    currentWaist !== null && currentWaist !== undefined && startWaist !== null && startWaist !== undefined
      ? Math.round((currentWaist - startWaist) * 10) / 10
      : 0;

  // Consistency score calculation
  const totalWeeksPassed = Math.min(currentWeek, 16);
  let totalAdherenceNutrition = 0;
  let totalAdherenceTraining = 0;
  let checkinLoggedCount = 0;

  for (let w = 1; w <= totalWeeksPassed; w++) {
    const c = checkins.find((x) => x.week === w);
    if (c?.data) {
      checkinLoggedCount++;

      // Safely parse nutrition adherence days (0-7)
      let nutDays: number | null = null;
      if (typeof c.data.nutrition === 'number' && !isNaN(c.data.nutrition)) {
        nutDays = c.data.nutrition;
      } else if (c.data.nutrition && typeof c.data.nutrition === 'object') {
        const obj = c.data.nutrition as any;
        if (typeof obj.adherenceDays === 'number' && !isNaN(obj.adherenceDays)) {
          nutDays = obj.adherenceDays;
        }
      }
      if (nutDays === null && typeof c.data.energy === 'number' && !isNaN(c.data.energy)) {
        nutDays = c.data.energy;
      }

      if (nutDays !== null) {
        totalAdherenceNutrition += Math.min(7, Math.max(0, nutDays)) / 7;
      } else {
        totalAdherenceNutrition += 0.7; // default fallback if logged
      }

      if (c.data.training && typeof c.data.training === 'object') {
        // sessions
        const planned = profile.training_days && profile.training_days <= 7 ? profile.training_days : 4;
        const count = Object.values(c.data.training).filter(
          (lifts) =>
            Array.isArray(lifts) &&
            lifts.some((s) => s && (s.name || s.weight || s.reps || (s.sets && s.sets.length > 0)))
        ).length;
        totalAdherenceTraining += Math.min(1, count / planned);
      } else {
        totalAdherenceTraining += 0.7;
      }
    }
  }

  const checkinScore = totalWeeksPassed > 0 ? (checkinLoggedCount / totalWeeksPassed) * 100 : 0;
  const rawNutScore = totalWeeksPassed > 0 ? (totalAdherenceNutrition / totalWeeksPassed) * 100 : 0;
  const nutritionScore = isNaN(rawNutScore) ? 0 : rawNutScore;
  const rawTrainScore = totalWeeksPassed > 0 ? (totalAdherenceTraining / totalWeeksPassed) * 100 : 0;
  const trainingScore = isNaN(rawTrainScore) ? 0 : rawTrainScore;

  const overallScore = Math.round(
    trainingScore * 0.4 + nutritionScore * 0.4 + checkinScore * 0.2
  );

  const goalBadgeText = profile.goal === 'bulking' ? t('goal_bulking') : t('goal_cutting');

  return (
    <div className="space-y-6">
      {/* Admin Switcher Banner */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/60 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900 border border-amber-300">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-amber-950">
                {language === 'th' ? 'โหมดติดตามผลส่วนตัวของแอดมิน (Admin Tracking)' : 'Admin Personal Tracking Mode'}
              </p>
              <p className="text-[11px] text-amber-800">
                {language === 'th'
                  ? 'คุณกำลังดูสถิติและกราฟส่วนตัวของคุณ สามารถสลับไปหน้าจัดการลูกเทรนได้ตลอดเวลา'
                  : 'You are viewing your personal stats. Switch to coach management anytime.'}
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="btn primary small flex items-center gap-1.5 text-xs shrink-0 self-end sm:self-auto"
          >
            <ShieldCheck size={14} />
            <span>{language === 'th' ? 'แดชบอร์ดจัดการลูกเทรน' : 'Manage Trainees'}</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--brown-dark)]">
            {t('dash_title', profile.name)}
          </h1>
          <p className="text-xs font-semibold text-[var(--muted)]">
            {t('week1to16')} • {goalBadgeText}
          </p>
        </div>
        <Link
          href={`/checkin/${currentWeek}`}
          className="btn primary small w-fit mt-2 sm:mt-0 flex items-center gap-1.5"
        >
          <span>{t('checkin_title')} ({t('week_pill', currentWeek)})</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* 3 Main Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="stat-card">
          <div className="stat-label">{t('stat_currentWeight')}</div>
          <div className="stat-value">
            {currentWeight !== null ? `${currentWeight} kg` : '—'}
          </div>
          <div className="mt-1 text-xs font-bold text-[var(--muted)]">
            {t('stat_startWeight')}: {startWeight} kg
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('stat_totalChange')}</div>
          <div
            className={`stat-value ${
              weightChange < 0
                ? 'text-emerald-700'
                : weightChange > 0
                ? 'text-amber-800'
                : 'text-[var(--brown-dark)]'
            }`}
          >
            {weightChange > 0 ? `+${weightChange}` : weightChange} kg
          </div>
          <div className="mt-1 text-xs font-bold text-[var(--muted)]">
            {profile.target_weight ? `Target: ${profile.target_weight} kg` : '—'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('stat_currentWaist')}</div>
          <div className="stat-value">
            {currentWaist !== null ? `${currentWaist} cm` : '—'}
          </div>
          <div className="mt-1 text-xs font-bold text-[var(--muted)]">
            {t('stat_waistChange')}: {waistChange > 0 ? `+${waistChange}` : waistChange} cm
          </div>
        </div>
      </div>

      {/* 16-Week Progress Track */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-extrabold tracking-wider text-[var(--brown-dark)]">
            {t('program_progress')}
          </span>
          <span className="text-xs font-bold text-[var(--muted)]">
            {t('week_pill', currentWeek)}
          </span>
        </div>

        <div className="flex gap-1.5 sm:gap-2">
          {weeks.map((w) => {
            const st = getWeekStatus(w);
            let bg = 'bg-[var(--border)]';
            if (st === 'completed') bg = 'bg-[var(--brown)]';
            if (st === 'current') bg = 'bg-[var(--brown-dark)] ring-2 ring-[var(--cream)]';
            if (st === 'missing-photos') bg = 'bg-amber-600';

            return (
              <Link
                key={w}
                href={`/checkin/${w}`}
                title={`Week ${w} - ${st}`}
                className={`h-7 flex-1 rounded-md transition-all hover:opacity-80 flex items-center justify-center text-[9px] font-black ${bg} ${
                  st === 'completed' || st === 'current' ? 'text-white' : 'text-[var(--muted)]'
                }`}
              >
                {w}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Consistency Score Card */}
      <div className="card grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
        <div className="text-center sm:border-r border-[var(--border)] sm:pr-6">
          <div
            className="consistency-ring"
            style={{
              background: `conic-gradient(var(--brown) calc(${overallScore} * 1%), var(--border) 0)`,
            }}
          >
            <div className="ring-inner">
              <span className="text-2xl font-black text-[var(--brown-dark)]">
                {overallScore}%
              </span>
              <span className="text-[9px] font-extrabold text-[var(--muted)]">
                CONSISTENCY
              </span>
            </div>
          </div>
          <div className="text-xs font-bold text-[var(--brown-dark)] mt-1">
            Overall Program Adherence
          </div>
        </div>

        <div className="col-span-2 space-y-3">
          <div>
            <div className="flex justify-between text-xs font-bold text-[var(--brown-dark)] mb-1">
              <span>{t('training')}</span>
              <span>{Math.round(trainingScore)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--cream-soft)] overflow-hidden">
              <div
                className="h-full bg-[var(--brown)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, trainingScore)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-[var(--brown-dark)] mb-1">
              <span>{t('nutrition')}</span>
              <span>{Math.round(nutritionScore)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--cream-soft)] overflow-hidden">
              <div
                className="h-full bg-[var(--brown)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, nutritionScore)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-[var(--brown-dark)] mb-1">
              <span>{t('checkin_lbl')}</span>
              <span>{Math.round(checkinScore)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--cream-soft)] overflow-hidden">
              <div
                className="h-full bg-[var(--brown)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, checkinScore)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TrendChart
          title={t('avgWeightKg')}
          labels={weeks.map((w) => `W${w}`)}
          data={weightSeries}
          unit="kg"
          borderColor="#6B5138"
          backgroundColor="rgba(107, 81, 56, 0.08)"
        />

        <TrendChart
          title={t('waistCm')}
          labels={weeks.map((w) => `W${w}`)}
          data={waistSeries}
          unit="cm"
          borderColor="#8C6D4F"
          backgroundColor="rgba(140, 109, 79, 0.08)"
        />

        <TrendChart
          title={t('stepsPerDay')}
          labels={weeks.map((w) => `W${w}`)}
          data={stepsSeries}
          unit="steps"
          borderColor="#4A6B51"
          backgroundColor="rgba(74, 107, 81, 0.08)"
        />

        <TrendChart
          title={t('act_cardioMin')}
          labels={weeks.map((w) => `W${w}`)}
          data={cardioSeries}
          unit="min"
          borderColor="#7A4B6B"
          backgroundColor="rgba(122, 75, 107, 0.08)"
        />
      </div>
    </div>
  );
}

