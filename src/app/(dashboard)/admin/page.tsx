'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { Profile, Checkin } from '@/types/database';
import { TraineeDetailModal } from '@/components/admin/TraineeDetailModal';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Users,
  Flame,
  Dumbbell,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';

export default function AdminPage() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [trainees, setTrainees] = useState<Profile[]>([]);
  const [allCheckins, setAllCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [goalFilter, setGoalFilter] = useState<'all' | 'cutting' | 'bulking'>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<Profile | null>(null);

  // Fetch all trainees and their checkins
  useEffect(() => {
    if (!isAdmin) return;

    async function loadAdminData() {
      setLoading(true);
      try {
        const { data: pData, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;
        setTrainees(pData || []);

        const { data: cData, error: cErr } = await supabase
          .from('checkins')
          .select('*')
          .order('week', { ascending: true });

        if (cErr) throw cErr;
        setAllCheckins(cData || []);
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--border)] border-t-[var(--brown)]" />
      </div>
    );
  }

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="card mx-auto max-w-md py-12 text-center">
        <ShieldAlert size={48} className="mx-auto mb-3 text-amber-700" />
        <h1 className="text-base font-black text-[var(--brown-dark)] mb-2">
          {t('admin_access_denied')}
        </h1>
        <p className="text-xs text-[var(--muted)] mb-6">
          You do not have permission to view the admin overview. Please contact your administrator if you need access.
        </p>
        <Link href="/dashboard" className="btn primary small">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Calculate trainee current week helper (syncs with latest logged week or calendar)
  const getTraineeCurrentWeek = (trainee: Profile, userCheckins: Checkin[]): number => {
    let calWeek = 1;
    if (trainee.start_date) {
      const start = new Date(trainee.start_date + 'T00:00:00');
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        calWeek = Math.floor(diffDays / 7) + 1;
      }
    }

    // Check highest week with logged check-in data
    const maxLoggedWeek = userCheckins.reduce((max, c) => {
      const d = c.data;
      if (!d) return max;
      const hasWaist = Boolean(d.waist);
      const hasWeights = Boolean(
        d.days && Object.values(d.days).some((item) => item?.weight !== null && item?.weight !== undefined)
      );
      const hasPhotos = Boolean(
        d.photos && (d.photos.front || d.photos.left || d.photos.right || d.photos.back)
      );
      const hasLifts = Boolean(
        d.training && typeof d.training === 'object' && Object.values(d.training).some(
          (lifts) => Array.isArray(lifts) && lifts.some((l) => l && (l.name || l.weight || l.reps))
        )
      );
      const hasNotes = Boolean(d.notes && d.notes.trim().length > 0);

      const hasContent = hasWaist || hasWeights || hasPhotos || hasLifts || hasNotes;
      return hasContent && c.week > max ? c.week : max;
    }, 1);

    const maxProgramWeeks = trainee.training_days && trainee.training_days > 7 ? trainee.training_days : 16;
    return Math.min(maxProgramWeeks, Math.max(1, Math.max(calWeek, maxLoggedWeek)));
  };

  // Trainee check-in stats calculation helper
  const getTraineeStats = (trainee: Profile) => {
    const userCheckins = allCheckins.filter((c) => c.user_id === trainee.id);
    const curWeek = getTraineeCurrentWeek(trainee, userCheckins);
    const totalWeeks = trainee.training_days && trainee.training_days > 7 ? trainee.training_days : 16;

    // Latest weight
    const weights: number[] = [];
    userCheckins.forEach((c) => {
      if (c.data?.days) {
        const dWeights = Object.values(c.data.days)
          .map((d) => d?.weight)
          .filter((v): v is number => v !== null && v !== undefined);
        if (dWeights.length > 0) {
          weights.push(dWeights.reduce((a, b) => a + b, 0) / dWeights.length);
        }
      }
    });

    const startWeight = trainee.start_weight;
    const latestWeight = weights.length > 0 ? Math.round(weights[weights.length - 1] * 10) / 10 : startWeight;
    const weightDelta =
      latestWeight !== null && startWeight !== null
        ? Math.round((latestWeight - startWeight) * 10) / 10
        : null;

    // Latest waist
    const waists = userCheckins
      .map((c) => c.data?.waist)
      .filter((w): w is number => w !== null && w !== undefined);
    const startWaist = trainee.start_waist;
    const latestWaist = waists.length > 0 ? waists[waists.length - 1] : startWaist;
    const waistDelta =
      latestWaist !== null && startWaist !== null
        ? Math.round((latestWaist - startWaist) * 10) / 10
        : null;

    // Checkin for current week
    const currentWeekCheckin = userCheckins.find((c) => c.week === curWeek);
    const hasCheckedInCurrentWeek = Boolean(
      currentWeekCheckin?.data?.waist ||
      (currentWeekCheckin?.data?.days &&
        Object.values(currentWeekCheckin.data.days).some((d) => d?.weight !== null && d?.weight !== undefined)) ||
      (currentWeekCheckin?.data?.training &&
        Object.values(currentWeekCheckin.data.training).some((l) => Array.isArray(l) && l.length > 0)) ||
      (currentWeekCheckin?.data?.photos &&
        (currentWeekCheckin.data.photos.front || currentWeekCheckin.data.photos.left || currentWeekCheckin.data.photos.right || currentWeekCheckin.data.photos.back))
    );

    // Consistency score
    const weeksPassed = Math.min(curWeek, totalWeeks);
    const completedCount = userCheckins.filter((c) => c.data?.waist || c.data?.days).length;
    const consistencyPct = weeksPassed > 0 ? Math.round((completedCount / weeksPassed) * 100) : 0;

    return {
      curWeek,
      totalWeeks,
      userCheckins,
      startWeight,
      latestWeight,
      weightDelta,
      startWaist,
      latestWaist,
      waistDelta,
      hasCheckedInCurrentWeek,
      consistencyPct,
    };
  };

  // Filter trainees
  const filteredTrainees = trainees.filter((trainee) => {
    const matchesSearch =
      !searchQuery ||
      (trainee.name && trainee.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      trainee.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGoal =
      goalFilter === 'all' || trainee.goal === goalFilter;

    return matchesSearch && matchesGoal;
  });

  // Top summary metrics
  const totalCount = trainees.length;
  const cuttingCount = trainees.filter((t) => t.goal === 'cutting').length;
  const bulkingCount = trainees.filter((t) => t.goal === 'bulking').length;
  const checkedInThisWeekCount = trainees.filter((t) => getTraineeStats(t).hasCheckedInCurrentWeek).length;
  const pendingCheckinCount = totalCount - checkedInThisWeekCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[var(--brown-dark)]">
              {t('admin_title')}
            </h1>
            <span className="rounded-full bg-[var(--brown-dark)] px-2.5 py-0.5 text-[10px] font-black text-white">
              ADMIN
            </span>
          </div>
          <p className="text-xs font-bold text-[var(--muted)]">
            {t('admin_sub')}
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-label">{t('admin_total_trainees')}</div>
          <div className="stat-value flex items-center justify-center gap-1.5">
            <Users size={22} className="text-[var(--brown)]" />
            <span>{totalCount}</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[var(--muted)]">
            {cuttingCount} {t('admin_cutting_count')} • {bulkingCount} {t('admin_bulking_count')}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('admin_active_this_week')}</div>
          <div className="stat-value text-emerald-800 flex items-center justify-center gap-1.5">
            <CheckCircle2 size={22} className="text-emerald-700" />
            <span>{checkedInThisWeekCount}</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-700">
            {totalCount > 0 ? `${Math.round((checkedInThisWeekCount / totalCount) * 100)}% active` : '0%'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('admin_pending_checkin')}</div>
          <div className="stat-value text-amber-800 flex items-center justify-center gap-1.5">
            <Clock size={22} className="text-amber-700" />
            <span>{pendingCheckinCount}</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-amber-700">
            Awaiting check-in
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">PROGRAM GOALS</div>
          <div className="stat-value flex items-center justify-center gap-2 text-sm font-black text-[var(--brown-dark)] pt-2">
            <span className="rounded-lg bg-[var(--cream)] px-2 py-1">
              🔥 {cuttingCount} Cut
            </span>
            <span className="rounded-lg bg-[var(--beige)] px-2 py-1">
              💪 {bulkingCount} Bulk
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card flex flex-col sm:flex-row items-center justify-between gap-3 p-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin_search_placeholder')}
            className="w-full rounded-xl border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-xs text-[var(--text)] outline-none focus:border-[var(--brown)]"
          />
        </div>

        <div className="flex w-full sm:w-auto gap-2">
          {(['all', 'cutting', 'bulking'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGoalFilter(g)}
              className={`flex-1 sm:flex-initial rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                goalFilter === g
                  ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white'
                  : 'border-[var(--border)] bg-[var(--paper-light)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
              }`}
            >
              {g === 'all' ? 'ALL GOALS' : g === 'cutting' ? t('goal_cutting') : t('goal_bulking')}
            </button>
          ))}
        </div>
      </div>

      {/* Trainees List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brown)]" />
        </div>
      ) : filteredTrainees.length === 0 ? (
        <div className="card py-16 text-center">
          <Users size={36} className="mx-auto mb-2 text-[var(--muted)]" />
          <h3 className="text-sm font-black text-[var(--brown-dark)]">
            {t('admin_no_trainees')}
          </h3>
          <p className="text-xs text-[var(--muted)] mt-1">
            Try adjusting your search query or filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTrainees.map((trainee) => {
            const stats = getTraineeStats(trainee);
            const goalBadgeColor =
              trainee.goal === 'cutting'
                ? 'border-[var(--brown)] text-[var(--brown-dark)] bg-[var(--cream-soft)]'
                : 'border-[var(--beige)] text-[var(--brown-dark)] bg-[var(--cream)]';

            return (
              <div
                key={trainee.id}
                className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 transition-all hover:border-[var(--brown)]"
              >
                {/* Trainee Profile Summary */}
                <div className="flex items-center gap-3 min-w-48">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brown-dark)] font-black text-sm text-white">
                    {trainee.name ? trainee.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--brown-dark)]">
                      {trainee.name || 'Unnamed Trainee'}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
                      <span>Week {stats.curWeek}/16</span>
                      <span>Week {stats.curWeek}/{stats.totalWeeks}</span>
                      <span>•</span>
                      <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-extrabold uppercase ${goalBadgeColor}`}>
                        {trainee.goal}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metric Badges */}
                <div className="grid grid-cols-3 gap-4 text-center w-full md:w-auto">
                  <div className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">WEIGHT</div>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {stats.latestWeight ? `${stats.latestWeight} kg` : '—'}
                    </div>
                    {stats.weightDelta !== null && (
                      <div
                        className={`text-[10px] font-bold ${
                          stats.weightDelta < 0 ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {stats.weightDelta > 0 ? `+${stats.weightDelta}` : stats.weightDelta} kg
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">WAIST</div>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {stats.latestWaist ? `${stats.latestWaist} cm` : '—'}
                    </div>
                    {stats.waistDelta !== null && (
                      <div
                        className={`text-[10px] font-bold ${
                          stats.waistDelta < 0 ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {stats.waistDelta > 0 ? `+${stats.waistDelta}` : stats.waistDelta} cm
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5">
                    <div className="text-[9px] font-bold text-[var(--muted)] uppercase">ADHERENCE</div>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {stats.consistencyPct}%
                    </div>
                    <div className="text-[10px] font-semibold text-[var(--muted)]">
                      {stats.userCheckins.length} logged
                    </div>
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-[var(--border)]">
                  <div>
                    {stats.hasCheckedInCurrentWeek ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={12} />
                        Checked In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-200">
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTrainee(trainee)}
                    className="btn primary small flex items-center gap-1 text-xs"
                  >
                    <span>{t('admin_view_detail')}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trainee Detail Modal with Photos, Metrics & Training Logs */}
      {selectedTrainee && (
        <TraineeDetailModal
          trainee={selectedTrainee}
          allCheckins={allCheckins}
          onClose={() => setSelectedTrainee(null)}
        />
      )}
    </div>
  );
}

