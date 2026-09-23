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
  Trash2,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

export default function AdminPage() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [trainees, setTrainees] = useState<Profile[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<'trainees' | 'admins'>('trainees');
  const [allCheckins, setAllCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [goalFilter, setGoalFilter] = useState<'all' | 'cutting' | 'bulking'>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<Profile | null>(null);

  // Trainee deletion from roster state
  const [traineeToDelete, setTraineeToDelete] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteUser = async () => {
    if (!traineeToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_user', {
        p_user_id: traineeToDelete.id,
      });

      if (rpcErr) {
        console.warn('admin_delete_user RPC error, fallback:', rpcErr);
        await supabase.from('checkins').delete().eq('user_id', traineeToDelete.id);
        await supabase.from('checkin_photos').delete().eq('user_id', traineeToDelete.id);
        await supabase.from('trainee_profiles').delete().eq('user_id', traineeToDelete.id);
        const { error: profErr } = await supabase.from('profiles').delete().eq('id', traineeToDelete.id);
        if (profErr) throw profErr;
      }

      setTrainees((prev) => prev.filter((t) => t.id !== traineeToDelete.id));
      setAllCheckins((prev) => prev.filter((c) => c.user_id !== traineeToDelete.id));
      if (selectedTrainee?.id === traineeToDelete.id) {
        setSelectedTrainee(null);
      }
      setTraineeToDelete(null);
    } catch (err: any) {
      console.error('Delete user error:', err);
      setDeleteError(err.message || t('admin_delete_failed'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch all trainees and their checkins
  useEffect(() => {
    if (!isAdmin) return;

    async function loadAdminData() {
      setLoading(true);
      try {
        // 1. Fetch user accounts (only email, name, gender, role)
        const { data: pData, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;

        // 2. Fetch separated trainee profiles (fitness metrics)
        const { data: tData } = await supabase
          .from('trainee_profiles')
          .select('*');

        const tMap = new Map((tData || []).map((t: any) => [t.user_id, t]));

        // Separate coaches (admins) from trainees so coach NEVER appears in trainee list!
        const realTrainees: Profile[] = (pData || [])
          .filter((p: any) => p.role !== 'admin')
          .map((p: any) => {
            const tInfo = tMap.get(p.id) || {};
            return {
              ...p,
              ...tInfo,
              id: p.id,
            };
          });

        setTrainees(realTrainees);

        const adminAccounts: Profile[] = (pData || []).filter((p: any) => p.role === 'admin');
        setAdmins(adminAccounts);

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
          (lifts) => Array.isArray(lifts) && lifts.some((l: any) => l && (l.name || l.weight || l.reps || (l.sets && l.sets.length > 0)))
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
      latestWeight !== null && latestWeight !== undefined && startWeight !== null && startWeight !== undefined
        ? Math.round((latestWeight - startWeight) * 10) / 10
        : null;

    // Latest waist
    const waists = userCheckins
      .map((c) => c.data?.waist)
      .filter((w): w is number => w !== null && w !== undefined);
    const startWaist = trainee.start_waist;
    const latestWaist = waists.length > 0 ? waists[waists.length - 1] : startWaist;
    const waistDelta =
      latestWaist !== null && latestWaist !== undefined && startWaist !== null && startWaist !== undefined
        ? Math.round((latestWaist - startWaist) * 10) / 10
        : null;

    // Checkin for current week
    const currentWeekCheckin = userCheckins.find((c) => c.week === curWeek);
    const hasCheckedInCurrentWeek = Boolean(
      currentWeekCheckin?.data?.waist ||
      (currentWeekCheckin?.data?.days &&
        Object.values(currentWeekCheckin.data.days).some((d) => d?.weight !== null && d?.weight !== undefined)) ||
      (currentWeekCheckin?.data?.training &&
        Object.values(currentWeekCheckin.data.training).some((l: any) =>
          Array.isArray(l) && l.some((x: any) => x && (x.name || x.weight || x.reps || (x.sets && x.sets.length > 0)))
        )) ||
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

      {/* Tabs: Trainees vs Admins */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('trainees')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
            activeTab === 'trainees'
              ? 'border-[var(--brown-dark)] text-[var(--brown-dark)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--brown)]'
          }`}
        >
          <Users size={15} />
          <span>{t('admin_trainee_list')}</span>
          <span className="rounded-full bg-[var(--cream)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--brown-dark)]">
            {trainees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('admins')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
            activeTab === 'admins'
              ? 'border-[var(--brown-dark)] text-[var(--brown-dark)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--brown)]'
          }`}
        >
          <ShieldCheck size={15} />
          <span>ผู้ดูแลระบบ & โค้ช</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300">
            {admins.length}
          </span>
        </button>
      </div>

      {activeTab === 'trainees' && (
        <>
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
        </>
      )}

      {/* Trainees List */}
      {activeTab === 'trainees' && (
        loading ? (
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
                        <span>Week {stats.curWeek}/{stats.totalWeeks}</span>
                        <span>•</span>
                        <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-extrabold uppercase ${goalBadgeColor}`}>
                          {trainee.goal || 'cutting'}
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
                      <div className="text-[9px] font-bold text-[var(--muted)] uppercase">CONSISTENCY</div>
                      <div className="text-xs font-black text-[var(--brown-dark)]">
                        {stats.consistencyPct}%
                      </div>
                      <div className="text-[10px] font-bold text-[var(--muted)]">
                        {stats.userCheckins.length} wks
                      </div>
                    </div>
                  </div>

                  {/* Current Week Status & Quick Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
                    <div>
                      {stats.hasCheckedInCurrentWeek ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                          <CheckCircle2 size={12} />
                          <span>Logged W{stats.curWeek}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          <Clock size={12} />
                          <span>Pending W{stats.curWeek}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTrainee(trainee)}
                        className="btn primary small flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <span>{t('admin_view_detail')}</span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setTraineeToDelete(trainee);
                        }}
                        title={t('admin_delete_user')}
                        className="rounded-xl border border-red-200 bg-red-50/70 p-2 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Admins & Coaches List */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="card p-4 bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
            <ShieldCheck size={22} className="shrink-0 text-amber-700" />
            <div>
              <p className="font-bold text-sm">ผู้ดูแลระบบและโค้ช (Admins / Coaches)</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                บัญชีที่มีบทบาทเป็นแอดมินจะถูกแยกไว้เฉพาะ ไม่จำเป็นต้องกรอกข้อมูล Onboarding หรือข้อมูลฟิตเนสใดๆ และจะไม่แสดงในตารางลูกเทรน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {admins.map((adm) => (
              <div
                key={adm.id}
                className="card flex items-center justify-between p-4 border border-[var(--border)] bg-[var(--paper-light)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-900 font-black text-sm text-amber-100">
                    {adm.name ? adm.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-[var(--brown-dark)] truncate">
                        {adm.name || 'Coach / Admin'}
                      </h4>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300">
                        <ShieldCheck size={11} />
                        <span>COACH</span>
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[var(--muted)] truncate">
                      {adm.email || adm.id}
                    </div>
                    {adm.created_at && (
                      <div className="text-[10px] font-medium text-[var(--muted)] mt-0.5">
                        เพิ่มเมื่อ: {new Date(adm.created_at).toLocaleDateString('th-TH')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainee Detail Modal with Photos, Metrics, Training Logs & Admin Controls */}
      {selectedTrainee && (
        <TraineeDetailModal
          trainee={selectedTrainee}
          allCheckins={allCheckins}
          onClose={() => setSelectedTrainee(null)}
          onUserDeleted={(userId) => {
            setTrainees((prev) => prev.filter((t) => t.id !== userId));
            setAllCheckins((prev) => prev.filter((c) => c.user_id !== userId));
            setSelectedTrainee(null);
          }}
          onUserDataReset={(userId) => {
            setAllCheckins((prev) => prev.filter((c) => c.user_id !== userId));
          }}
        />
      )}

      {/* ROSTER QUICK DELETE CONFIRMATION MODAL */}
      {traineeToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--paper-light)] p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--brown-dark)]">
                  {t('admin_delete_user_confirm_title')}
                </h3>
                <div className="text-[11px] font-semibold text-[var(--muted)]">
                  {traineeToDelete.name || 'ลูกเทรน'} ({traineeToDelete.goal})
                </div>
              </div>
            </div>
            <p className="text-xs text-red-800 leading-relaxed bg-red-50 p-3 rounded-xl border border-red-200">
              {t('admin_delete_user_confirm_body', traineeToDelete.name || 'ลูกเทรน')}
            </p>
            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-red-100 p-2.5 text-xs font-semibold text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setTraineeToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="btn secondary small text-xs cursor-pointer"
              >
                {t('admin_cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="btn small bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 text-xs cursor-pointer shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>กำลังลบบัญชี...</span>
                  </>
                ) : (
                  <span>{t('admin_confirm_delete')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

