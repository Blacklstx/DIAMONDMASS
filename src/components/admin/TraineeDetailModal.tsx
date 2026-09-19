'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Profile, Checkin, TrainingLift } from '@/types/database';
import {
  X,
  Camera,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Dumbbell,
  Activity,
  Moon,
  MessageSquare,
  Maximize2,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface TraineeDetailModalProps {
  trainee: Profile | null;
  allCheckins: Checkin[];
  onClose: () => void;
  onUserDeleted?: (userId: string) => void;
  onUserDataReset?: (userId: string) => void;
}

export function TraineeDetailModal({
  trainee,
  allCheckins,
  onClose,
  onUserDeleted,
  onUserDataReset,
}: TraineeDetailModalProps) {
  const { t } = useLanguage();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'checkin' | 'photos' | 'before_after'>('checkin');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [activeTrainingDay, setActiveTrainingDay] = useState<string>('day1');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // Admin delete/reset states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDeleteUser = async () => {
    if (!trainee) return;
    setProcessingAction('delete');
    setActionError(null);

    try {
      // 1. Try RPC admin_delete_user
      const { error: rpcErr } = await supabase.rpc('admin_delete_user', {
        p_user_id: trainee.id,
      });

      if (rpcErr) {
        console.warn('admin_delete_user RPC error, using fallback:', rpcErr);
        await supabase.from('checkins').delete().eq('user_id', trainee.id);
        await supabase.from('checkin_photos').delete().eq('user_id', trainee.id);
        await supabase.from('trainee_profiles').delete().eq('user_id', trainee.id);
        const { error: profErr } = await supabase.from('profiles').delete().eq('id', trainee.id);
        if (profErr) throw profErr;
      }

      onUserDeleted?.(trainee.id);
      onClose();
    } catch (err: any) {
      console.error('Delete user error:', err);
      setActionError(err.message || t('admin_delete_failed'));
      setProcessingAction(null);
    }
  };

  const handleResetUserData = async () => {
    if (!trainee) return;
    setProcessingAction('reset');
    setActionError(null);

    try {
      // 1. Try RPC admin_reset_user_data
      const { error: rpcErr } = await supabase.rpc('admin_reset_user_data', {
        p_user_id: trainee.id,
      });

      if (rpcErr) {
        console.warn('admin_reset_user_data RPC error, using fallback:', rpcErr);
        const { error: cErr } = await supabase.from('checkins').delete().eq('user_id', trainee.id);
        if (cErr) throw cErr;
        await supabase.from('checkin_photos').delete().eq('user_id', trainee.id);
      }

      onUserDataReset?.(trainee.id);
      setShowResetConfirm(false);
      setSelectedWeek(1);
      setPhotoUrls({});
      setProcessingAction(null);
    } catch (err: any) {
      console.error('Reset data error:', err);
      setActionError(err.message || t('admin_reset_failed'));
      setProcessingAction(null);
    }
  };

  // Filter checkins for this trainee
  const traineeCheckins = trainee
    ? allCheckins.filter((c) => c.user_id === trainee.id)
    : [];

  // Calculate current week (syncs with latest logged week or calendar)
  const getCurrentWeek = (): number => {
    if (!trainee) return 1;
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
    const maxLoggedWeek = traineeCheckins.reduce((max, c) => {
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

  const currentWeek = getCurrentWeek();

  // Set initial selected week to current week when modal opens
  useEffect(() => {
    if (trainee) {
      setSelectedWeek(currentWeek);
    }
  }, [trainee]);

  // Load photos for this trainee
  useEffect(() => {
    if (!trainee) return;
    const traineeId = trainee.id;

    async function loadTraineePhotos() {
      setLoadingPhotos(true);
      const urls: Record<string, string> = {};
      const views = ['front', 'left', 'right', 'back'] as const;

      // 1. Try querying checkin_photos table first
      try {
        const { data: photoRecords } = await supabase
          .from('checkin_photos')
          .select('*')
          .eq('user_id', traineeId);

        if (photoRecords && photoRecords.length > 0) {
          for (const rec of photoRecords) {
            const w = rec.week;
            for (const view of views) {
              const photoPath = rec[`photo_${view}_url` as keyof typeof rec] as string | undefined;
              if (photoPath) {
                const { data } = await supabase.storage
                  .from('progress-photos')
                  .createSignedUrl(photoPath, 3600);
                if (data?.signedUrl) {
                  urls[`${w}_${view}`] = data.signedUrl;
                }
              }
            }
          }
        }
      } catch {
        // Ignore if checkin_photos table not yet migrated
      }

      // 2. Scan all 16 weeks from checkins
      for (const c of traineeCheckins) {
        const w = c.week;
        const padWeek = String(w).padStart(2, '0');
        const cPhotos = c.data?.photos;

        for (const view of views) {
          if (cPhotos?.[view] && !urls[`${w}_${view}`]) {
            const path = `${trainee?.id}/week-${padWeek}/${view}.jpg`;
            const { data } = await supabase.storage
              .from('progress-photos')
              .createSignedUrl(path, 3600);
            if (data?.signedUrl) {
              urls[`${w}_${view}`] = data.signedUrl;
            }
          }
        }
      }

      setPhotoUrls(urls);
      setLoadingPhotos(false);
    }

    loadTraineePhotos();
  }, [trainee, traineeCheckins.length]);

  if (!trainee) return null;

  // Active checkin data for selected week
  const activeCheckin = traineeCheckins.find((c) => c.week === selectedWeek);
  const checkinData = activeCheckin?.data || {};

  // Weight stats for active week
  const days = checkinData.days || {};
  const dayWeights = Object.values(days)
    .map((d) => d?.weight)
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

  const weekAvgWeight =
    dayWeights.length > 0
      ? Math.round((dayWeights.reduce((a, b) => a + b, 0) / dayWeights.length) * 10) / 10
      : null;

  // Previous week average
  const prevCheckin = traineeCheckins.find((c) => c.week === selectedWeek - 1);
  const prevDayWeights = prevCheckin?.data?.days
    ? Object.values(prevCheckin.data.days)
        .map((d) => d?.weight)
        .filter((v): v is number => v !== null && v !== undefined)
    : [];
  const prevAvgWeight =
    prevDayWeights.length > 0
      ? prevDayWeights.reduce((a, b) => a + b, 0) / prevDayWeights.length
      : null;

  const weightDeltaFromPrev =
    weekAvgWeight !== null && prevAvgWeight !== null
      ? Math.round((weekAvgWeight - prevAvgWeight) * 10) / 10
      : null;

  // Day labels
  const dayLabels = [
    { key: 'day1', label: 'จันทร์ (Mon)' },
    { key: 'day2', label: 'อังคาร (Tue)' },
    { key: 'day3', label: 'พุธ (Wed)' },
    { key: 'day4', label: 'พฤหัส (Thu)' },
    { key: 'day5', label: 'ศุกร์ (Fri)' },
    { key: 'day6', label: 'เสาร์ (Sat)' },
    { key: 'day7', label: 'อาทิตย์ (Sun)' },
  ];

  // Training lifts for selected day
  const rawLifts = checkinData.training?.[activeTrainingDay];
  const activeLifts: TrainingLift[] = Array.isArray(rawLifts) ? rawLifts : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs">
      <div className="card flex h-full max-h-[95vh] w-full max-w-4xl flex-col bg-[var(--paper-light)] p-0 overflow-hidden shadow-2xl">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--cream-soft)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brown-dark)] font-black text-base text-white">
              {trainee.name ? trainee.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[var(--brown-dark)]">
                  {trainee.name || 'ลูกเทรน'}
                </h2>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    trainee.goal === 'cutting'
                      ? 'border-[var(--brown)] bg-[var(--cream-soft)] text-[var(--brown-dark)]'
                      : 'border-[var(--beige)] bg-[var(--cream)] text-[var(--brown-dark)]'
                  }`}
                >
                  {trainee.goal}
                </span>
                <span className="rounded-full bg-[var(--brown-dark)] px-2 py-0.5 text-[10px] font-black text-white">
                  Week {currentWeek} / 16
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] font-semibold">
                {trainee.age && <span>อายุ: {trainee.age} ปี</span>}
                {trainee.height && <span>ส่วนสูง: {trainee.height} ซม.</span>}
                {trainee.start_date && <span>เริ่มเมื่อ: {trainee.start_date}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setShowDeleteConfirm(true);
              }}
              title={t('admin_delete_user')}
              className="rounded-xl p-2 text-red-600 hover:bg-red-100/70 hover:text-red-700 transition-colors cursor-pointer"
            >
              <Trash2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--cream)] hover:text-[var(--brown-dark)] cursor-pointer"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* TARGETS SUMMARY BAR */}
        <div className="grid grid-cols-2 border-b border-[var(--border)] bg-[var(--paper)] px-6 py-2.5 sm:grid-cols-5 text-center text-xs font-bold gap-2">
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase">น้ำหนักเริ่มต้น</span>
            <div className="font-black text-[var(--brown-dark)]">{trainee.start_weight} kg</div>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase">เป้าหมายน้ำหนัก</span>
            <div className="font-black text-[var(--brown-dark)]">{trainee.target_weight || '—'} kg</div>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase">เป้าหมายแคลอรี่</span>
            <div className="font-black text-[var(--brown-dark)]">{trainee.calorie_target || '—'} kcal</div>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase">เป้าหมายโปรตีน</span>
            <div className="font-black text-[var(--brown-dark)]">{trainee.protein_target || '—'} g</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] text-[var(--muted)] uppercase">ระยะเวลาโปรแกรม</span>
            <div className="font-black text-[var(--brown-dark)]">{trainee.training_days || 16} สัปดาห์</div>
          </div>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="flex border-b border-[var(--border)] px-6 pt-3 gap-4 bg-[var(--paper-light)]">
          <button
            type="button"
            onClick={() => setActiveTab('checkin')}
            className={`pb-2.5 text-xs font-black transition-colors ${
              activeTab === 'checkin'
                ? 'border-b-2 border-[var(--brown-dark)] text-[var(--brown-dark)]'
                : 'text-[var(--muted)] hover:text-[var(--brown-dark)]'
            }`}
          >
            📋 บันทึกรายสัปดาห์ & รูปถ่าย (Weekly Check-in)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`pb-2.5 text-xs font-black transition-colors ${
              activeTab === 'photos'
                ? 'border-b-2 border-[var(--brown-dark)] text-[var(--brown-dark)]'
                : 'text-[var(--muted)] hover:text-[var(--brown-dark)]'
            }`}
          >
            📸 ไทม์ไลน์รูปภาพทั้งหมด (All Photos)
          </button>
        </div>

        {/* TAB 1: WEEKLY CHECKIN & PHOTOS */}
        {activeTab === 'checkin' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Week Selector Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-[var(--brown-dark)]">
                <span>เลือกสัปดาห์ที่ต้องการตรวจเช็ค:</span>
                <span className="text-[var(--muted)]">สัปดาห์ที่ {selectedWeek} จาก 16</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => {
                  const c = traineeCheckins.find((x) => x.week === w);
                  const hasData = Boolean(c?.data?.waist || c?.data?.days);
                  const hasPhotos = Boolean(
                    c?.data?.photos && Object.values(c.data.photos).some(Boolean)
                  );
                  const isSelected = selectedWeek === w;

                  let badgeColor = 'bg-[var(--border)] text-[var(--muted)]';
                  if (hasData) badgeColor = 'bg-[var(--cream)] text-[var(--brown-dark)]';
                  if (hasPhotos) badgeColor = 'bg-[var(--beige)] text-[var(--brown-dark)]';
                  if (isSelected) badgeColor = 'bg-[var(--brown-dark)] text-white shadow-sm';

                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setSelectedWeek(w)}
                      className={`h-9 min-w-10 rounded-xl px-2.5 text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${badgeColor}`}
                    >
                      <span>W{w}</span>
                      {hasPhotos && <span className="h-1 w-1 rounded-full bg-amber-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 1: PROGRESS PHOTOS OF SELECTED WEEK */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-[var(--brown)]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)]">
                    รูปถ่ายความคืบหน้า (สัปดาห์ที่ {selectedWeek})
                  </h3>
                </div>
                {loadingPhotos && (
                  <span className="text-[10px] font-bold text-[var(--muted)]">กำลังโหลดรูปภาพ...</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['front', 'left', 'right', 'back'] as const).map((view) => {
                  const viewLabels = {
                    front: 'ด้านหน้า (Front)',
                    left: 'ด้านซ้าย (Left)',
                    right: 'ด้านขวา (Right)',
                    back: 'ด้านหลัง (Back)',
                  };
                  const imgUrl = photoUrls[`${selectedWeek}_${view}`];

                  return (
                    <div
                      key={view}
                      className="group relative aspect-3/4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--cream-soft)] flex flex-col items-center justify-center p-2 text-center"
                    >
                      {imgUrl ? (
                        <>
                          <img
                            src={imgUrl}
                            alt={`${trainee.name} - Week ${selectedWeek} ${view}`}
                            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setZoomImage({
                                url: imgUrl,
                                title: `${trainee.name} - สัปดาห์ ${selectedWeek} (${viewLabels[view]})`,
                              })
                            }
                            className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
                            title="ขยายรูป"
                          >
                            <Maximize2 size={14} />
                          </button>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] font-extrabold text-white">
                            {viewLabels[view]}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1 text-[var(--muted)]">
                          <Camera size={22} className="opacity-40" />
                          <span className="text-[11px] font-bold">{viewLabels[view]}</span>
                          <span className="text-[10px] italic">ไม่มีรูปภาพ</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: WEIGHT & BODY MEASUREMENTS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Daily Bodyweights */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)]">
                    น้ำหนักตัวรายวัน (กก.)
                  </h3>
                  {weekAvgWeight !== null && (
                    <div className="text-xs font-extrabold text-[var(--brown-dark)]">
                      เฉลี่ย: <span className="text-sm font-black">{weekAvgWeight} kg</span>
                      {weightDeltaFromPrev !== null && (
                        <span
                          className={`ml-1.5 ${
                            weightDeltaFromPrev < 0
                              ? 'text-emerald-700'
                              : weightDeltaFromPrev > 0
                              ? 'text-amber-800'
                              : 'text-[var(--muted)]'
                          }`}
                        >
                          ({weightDeltaFromPrev > 0 ? `+${weightDeltaFromPrev}` : weightDeltaFromPrev} kg)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 text-center">
                  {dayLabels.map((d) => {
                    const wVal = checkinData.days?.[d.key]?.weight;
                    return (
                      <div key={d.key} className="rounded-xl border border-[var(--border)] bg-white p-2">
                        <div className="text-[9px] font-extrabold text-[var(--muted)]">
                          {d.label.split(' ')[0]}
                        </div>
                        <div className="text-xs font-black text-[var(--brown-dark)] mt-0.5">
                          {wVal !== null && wVal !== undefined ? `${wVal}` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Body Measurements */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
                <div className="border-b border-[var(--border)] pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)]">
                    รอบวัดร่างกาย (Body Measurements)
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">รอบเอว</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.waist ? `${checkinData.waist} cm` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">สะโพก</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.hips ? `${checkinData.hips} cm` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">รอบอก</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.chest ? `${checkinData.chest} cm` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">รอบแขน</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.arm ? `${checkinData.arm} cm` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">รอบต้นขา</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.thigh ? `${checkinData.thigh} cm` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">ทำตามแผน</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.energy ? `${checkinData.energy}/7 วัน` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: TRAINING LOG */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-[var(--brown)]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)]">
                    บันทึกการฝึกซ้อม (Training Log 7 วัน)
                  </h3>
                </div>
              </div>

              {/* Training Day Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {dayLabels.map((d) => {
                  const dLifts = checkinData.training?.[d.key];
                  const count = Array.isArray(dLifts)
                    ? dLifts.filter((l) => l && (l.name || l.weight || l.reps)).length
                    : 0;
                  const isActive = activeTrainingDay === d.key;

                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setActiveTrainingDay(d.key)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                        isActive
                          ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white'
                          : 'border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                      }`}
                    >
                      <span>{d.label.split(' ')[0]}</span>
                      {count > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                            isActive ? 'bg-white text-[var(--brown-dark)]' : 'bg-[var(--cream)] text-[var(--brown-dark)]'
                          }`}
                        >
                          {count} ท่า
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Lifts list */}
              {activeLifts.filter((l) => l && (l.name || l.weight || l.reps)).length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-4 text-center text-xs text-[var(--muted)] font-semibold">
                  ไม่มีการบันทึกท่าฝึกซ้อมสำหรับวันนี้
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
                  {activeLifts
                    .filter((l) => l && (l.name || l.weight || l.reps))
                    .map((lift, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2.5 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="h-5 w-5 shrink-0 rounded-full bg-[var(--cream)] text-center text-[10px] font-black leading-5 text-[var(--brown-dark)]">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-[var(--brown-dark)] truncate">{lift.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-black text-[var(--muted)] text-[11px]">
                          {lift.weight !== null && <span>{lift.weight} kg</span>}
                          {lift.reps !== null && <span>{lift.reps} ครั้ง</span>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* SECTION 4: ACTIVITY, SLEEP & COACH NOTES */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Activity & Sleep */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)] border-b border-[var(--border)] pb-2">
                  กิจกรรม & การพักผ่อน
                </h3>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">ก้าวเดินเฉลี่ย/วัน</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.steps ? `${checkinData.steps} ก้าว` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">คาร์ดิโอ/สัปดาห์</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.cardio ? `${checkinData.cardio} นาที` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">ชั่วโมงนอนเฉลี่ย</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.sleep ? `${checkinData.sleep} ชม.` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white p-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase">ระดับความเครียด</span>
                    <div className="text-xs font-black text-[var(--brown-dark)]">
                      {checkinData.stress ? `${checkinData.stress} / 5` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Note to Coach */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                  <MessageSquare size={16} className="text-[var(--brown)]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)]">
                    ข้อความถึงโค้ช (Note to Coach)
                  </h3>
                </div>

                {checkinData.notes ? (
                  <div className="rounded-xl border border-[var(--border)] bg-white p-3.5 text-xs text-[var(--brown-dark)] italic leading-relaxed">
                    &ldquo;{checkinData.notes}&rdquo;
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-6 text-center text-xs text-[var(--muted)] italic">
                    ลูกเทรนไม่ได้เขียนบันทึกสำหรับสัปดาห์นี้
                  </div>
                )}
              </div>
            </div>

            {/* Coach Share Link */}
            {trainee.coach_token && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--cream-soft)] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-[var(--brown-dark)] block">
                    ลิงก์รายงานแบบอ่านอย่างเดียวของลูกเทรนคนนี้:
                  </span>
                  <div className="text-[11px] text-[var(--muted)] font-mono truncate mt-0.5">
                    /coach/{trainee.coach_token}
                  </div>
                </div>
                <Link
                  href={`/coach/${trainee.coach_token}`}
                  target="_blank"
                  className="btn primary small flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto text-xs"
                >
                  <span>เปิดดูรายงานเต็ม</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            )}

            {/* DANGER ZONE: ADMIN CONTROLS */}
            <div className="rounded-2xl border border-red-200/80 bg-red-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-red-200/60 pb-2">
                <AlertTriangle size={16} className="text-red-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-red-900">
                  จัดการข้อมูลและบัญชีลูกเทรน (Admin Controls)
                </h3>
              </div>
              <p className="text-[11px] text-red-700/90 leading-relaxed">
                การลบข้อมูลจะไม่สามารถกู้คืนได้ โปรดใช้ความระมัดระวังในการดำเนินการ
              </p>
              {actionError && (
                <div className="rounded-xl border border-red-200 bg-red-100 p-2.5 text-xs font-bold text-red-800">
                  {actionError}
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setShowResetConfirm(true);
                  }}
                  disabled={Boolean(processingAction)}
                  className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex-1 sm:flex-initial"
                >
                  <RotateCcw size={14} className="text-amber-600" />
                  <span>{t('admin_reset_data')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setShowDeleteConfirm(true);
                  }}
                  disabled={Boolean(processingAction)}
                  className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex-1 sm:flex-initial"
                >
                  <Trash2 size={14} />
                  <span>{t('admin_delete_user')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ALL PHOTOS TIMELINE */}
        {activeTab === 'photos' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brown-dark)]">
                รูปถ่ายความคืบหน้าทุกสัปดาห์ (Front, Left, Right, Back)
              </h3>
              <span className="text-xs font-bold text-[var(--muted)]">
                สัปดาห์ 1 → สัปดาห์ 16
              </span>
            </div>

            <div className="space-y-6">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => {
                const views = ['front', 'left', 'right', 'back'] as const;
                const hasAnyPhotoInWeek = views.some((v) => photoUrls[`${w}_${v}`]);
                if (!hasAnyPhotoInWeek) return null;

                return (
                  <div key={w} className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-xs font-black text-[var(--brown-dark)]">
                      <span>สัปดาห์ที่ {w} (Week {w})</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWeek(w);
                          setActiveTab('checkin');
                        }}
                        className="text-[11px] text-[var(--brown)] hover:underline"
                      >
                        ดูข้อมูลเช็คอินสัปดาห์นี้ ➔
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {views.map((view) => {
                        const url = photoUrls[`${w}_${view}`];
                        return (
                          <div
                            key={view}
                            className="group relative aspect-3/4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--cream-soft)] flex items-center justify-center"
                          >
                            {url ? (
                              <>
                                <img
                                  src={url}
                                  alt={`Week ${w} ${view}`}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setZoomImage({
                                      url,
                                      title: `${trainee.name} - สัปดาห์ ${w} (${view})`,
                                    })
                                  }
                                  className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
                                >
                                  <Maximize2 size={14} />
                                </button>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] font-extrabold text-white text-center uppercase">
                                  {view}
                                </div>
                              </>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] uppercase font-bold">
                                {view}: —
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* IMAGE ZOOM OVERLAY */}
        {zoomImage && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="relative max-h-[90vh] max-w-xl w-full flex flex-col items-center">
              <div className="flex w-full items-center justify-between text-white text-xs font-black pb-2">
                <span>{zoomImage.title}</span>
                <button
                  type="button"
                  onClick={() => setZoomImage(null)}
                  className="rounded-full bg-white/20 p-1 hover:bg-white/40 text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative aspect-3/4 w-full overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl">
                <img
                  src={zoomImage.url}
                  alt={zoomImage.title}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
        )}
        {/* RESET DATA CONFIRMATION MODAL */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--paper-light)] p-5 space-y-4 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3 text-amber-700">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--brown-dark)]">
                    {t('admin_reset_data_confirm_title')}
                  </h3>
                  <div className="text-[11px] font-semibold text-[var(--muted)]">
                    {trainee.name} ({trainee.goal})
                  </div>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed bg-[var(--paper)] p-3 rounded-xl border border-[var(--border)]">
                {t('admin_reset_data_confirm_body', trainee.name || 'ลูกเทรน')}
              </p>
              {actionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                  {actionError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={Boolean(processingAction)}
                  className="btn secondary small text-xs cursor-pointer"
                >
                  {t('admin_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleResetUserData}
                  disabled={Boolean(processingAction)}
                  className="btn small bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1.5 text-xs cursor-pointer shadow-xs"
                >
                  {processingAction === 'reset' ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>กำลังลบข้อมูล...</span>
                    </>
                  ) : (
                    <span>{t('admin_confirm_reset')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE USER CONFIRMATION MODAL */}
        {showDeleteConfirm && (
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
                    {trainee.name} ({trainee.goal})
                  </div>
                </div>
              </div>
              <p className="text-xs text-red-800 leading-relaxed bg-red-50 p-3 rounded-xl border border-red-200">
                {t('admin_delete_user_confirm_body', trainee.name || 'ลูกเทรน')}
              </p>
              {actionError && (
                <div className="rounded-xl border border-red-200 bg-red-100 p-2.5 text-xs font-semibold text-red-700">
                  {actionError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={Boolean(processingAction)}
                  className="btn secondary small text-xs cursor-pointer"
                >
                  {t('admin_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={Boolean(processingAction)}
                  className="btn small bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 text-xs cursor-pointer shadow-xs"
                >
                  {processingAction === 'delete' ? (
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
    </div>
  );
}
