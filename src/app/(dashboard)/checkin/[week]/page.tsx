'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image-compression';
import { CheckinData, TrainingLift } from '@/types/database';
import {
  Camera,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  CheckCircle2,
  Loader2,
  Cloud,
  Plus,
  X,
  Dumbbell,
  Layers,
} from 'lucide-react';

export default function CheckinPage() {
  const params = useParams();
  const weekParam = params?.week as string;
  const weekNum = Math.min(16, Math.max(1, parseInt(weekParam, 10) || 1));

  const { user, profile, checkins, currentWeek, refreshCheckins, getWeekStatus } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  // Active checkin data state
  const [data, setData] = useState<CheckinData>({});
  const [activeDayKey, setActiveDayKey] = useState<string>('day1');
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Auto-save state and refs
  type AutoSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const dataRef = useRef<CheckinData>(data);
  dataRef.current = data;

  const weekNumRef = useRef<number>(weekNum);
  weekNumRef.current = weekNum;

  const isSavingRef = useRef<boolean>(false);
  const isUserDirtyRef = useRef<boolean>(false);
  const ignoreNextDataChangeRef = useRef<boolean>(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadedForWeekRef = useRef<number | null>(null);

  // Initialize form state from database when weekNum changes
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    isUserDirtyRef.current = false;
    setAutoSaveStatus('idle');
    setLastSavedTime(null);
    ignoreNextDataChangeRef.current = true;

    const existing = checkins.find((c) => c.week === weekNum);
    if (existing?.data) {
      setData(existing.data);
    } else {
      setData({
        days: {
          day1: { weight: null },
          day2: { weight: null },
          day3: { weight: null },
          day4: { weight: null },
          day5: { weight: null },
          day6: { weight: null },
          day7: { weight: null },
        },
        training: {},
        photos: {},
      });
    }
    isLoadedForWeekRef.current = weekNum;
  }, [weekNum]);

  // If checkins arrive after initial mount and user has not typed yet
  useEffect(() => {
    if (!isUserDirtyRef.current && isLoadedForWeekRef.current === weekNum) {
      const existing = checkins.find((c) => c.week === weekNum);
      if (existing?.data) {
        ignoreNextDataChangeRef.current = true;
        setData(existing.data);
      }
    }
  }, [checkins, weekNum]);

  // Auto-save debounced effect on data changes
  useEffect(() => {
    if (ignoreNextDataChangeRef.current) {
      ignoreNextDataChangeRef.current = false;
      return;
    }
    if (!user) return;

    isUserDirtyRef.current = true;
    setAutoSaveStatus('unsaved');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      executeSave(dataRef.current, true);
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [data, user]);

  // Warning before unloading if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUserDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load signed URLs for photos from Supabase Storage
  useEffect(() => {
    if (!user) return;
    const views = ['front', 'left', 'right', 'back'] as const;
    const padWeek = String(weekNum).padStart(2, '0');

    async function loadUrls() {
      const urls: Record<string, string> = {};
      for (const view of views) {
        if (data.photos?.[view]) {
          const path = `${user?.id}/week-${padWeek}/${view}.jpg`;
          const { data: signedData } = await supabase.storage
            .from('progress-photos')
            .createSignedUrl(path, 3600);
          if (signedData?.signedUrl) {
            urls[view] = signedData.signedUrl;
          }
        }
      }
      setSignedPhotoUrls(urls);
    }

    loadUrls();
  }, [user, weekNum, data.photos]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (view: 'front' | 'left' | 'right' | 'back', file: File) => {
    if (!user) return;
    setUploadingPhoto(view);
    try {
      const compressed = await compressImage(file, 1200, 0.82);
      const padWeek = String(weekNum).padStart(2, '0');
      const path = `${user.id}/week-${padWeek}/${view}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('progress-photos')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

      if (uploadErr) throw uploadErr;

      const newPhotos = { ...(data.photos || {}), [view]: true };
      const updatedData = { ...data, photos: newPhotos };
      ignoreNextDataChangeRef.current = true;
      setData(updatedData);

      // Persist to checkins table
      await supabase.from('checkins').upsert({
        user_id: user.id,
        week: weekNum,
        data: updatedData,
      }, { onConflict: 'user_id,week' });

      // Also persist to dedicated checkin_photos table
      try {
        await supabase.from('checkin_photos').upsert({
          user_id: user.id,
          week: weekNum,
          [`${view}_path`]: path,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,week' });
      } catch (tableErr) {
        console.warn('checkin_photos table update ignored:', tableErr);
      }

      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setAutoSaveStatus('saved');
      isUserDirtyRef.current = false;

      await refreshCheckins();
      showToast(t('toast_photo_saved'));
    } catch (err: any) {
      console.error(err);
      showToast(t('toast_upload_failed'));
    } finally {
      setUploadingPhoto(null);
    }
  };

  // Photo Delete Handler
  const handlePhotoDelete = async (view: 'front' | 'left' | 'right' | 'back') => {
    if (!user) return;
    try {
      const padWeek = String(weekNum).padStart(2, '0');
      const path = `${user.id}/week-${padWeek}/${view}.jpg`;

      await supabase.storage.from('progress-photos').remove([path]);

      const newPhotos = { ...(data.photos || {}) };
      delete newPhotos[view];
      const updatedData = { ...data, photos: newPhotos };
      ignoreNextDataChangeRef.current = true;
      setData(updatedData);

      setSignedPhotoUrls((prev) => {
        const next = { ...prev };
        delete next[view];
        return next;
      });

      await supabase.from('checkins').upsert({
        user_id: user.id,
        week: weekNum,
        data: updatedData,
      }, { onConflict: 'user_id,week' });

      // Also update dedicated checkin_photos table
      try {
        await supabase.from('checkin_photos').upsert({
          user_id: user.id,
          week: weekNum,
          [`${view}_path`]: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,week' });
      } catch (tableErr) {
        console.warn('checkin_photos table update ignored:', tableErr);
      }

      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setAutoSaveStatus('saved');
      isUserDirtyRef.current = false;

      await refreshCheckins();
      showToast(t('toast_photo_removed'));
    } catch (err) {
      console.error(err);
      showToast(t('toast_delete_failed'));
    }
  };

  // Calculate weekly weight average
  const days = data.days || {};
  const dayWeights = Object.values(days)
    .map((d) => d?.weight)
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

  const weeklyAvgWeight =
    dayWeights.length > 0
      ? Math.round((dayWeights.reduce((a, b) => a + b, 0) / dayWeights.length) * 10) / 10
      : null;

  // Change from previous week
  const prevCheckin = checkins.find((c) => c.week === weekNum - 1);
  const prevWeights = prevCheckin?.data?.days
    ? Object.values(prevCheckin.data.days)
        .map((d) => d?.weight)
        .filter((v): v is number => v !== null && v !== undefined)
    : [];
  const prevAvgWeight =
    prevWeights.length > 0
      ? prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length
      : null;

  const weightDeltaFromLastWeek =
    weeklyAvgWeight !== null && prevAvgWeight !== null
      ? Math.round((weeklyAvgWeight - prevAvgWeight) * 10) / 10
      : null;

  // Training log lifts for active day (normalized with dynamic sets)
  const rawDayLifts = data.training?.[activeDayKey];
  const currentDayLifts: TrainingLift[] =
    rawDayLifts && rawDayLifts.length > 0
      ? rawDayLifts.map((l) => ({
          name: l.name || '',
          weight: l.weight ?? null,
          reps: l.reps ?? null,
          sets:
            Array.isArray(l.sets) && l.sets.length > 0
              ? l.sets.map((s) => ({ weight: s.weight ?? null, reps: s.reps ?? null }))
              : [{ weight: l.weight ?? null, reps: l.reps ?? null }],
        }))
      : [{ name: '', weight: null, reps: null, sets: [{ weight: null, reps: null }] }];

  const setLiftsForActiveDay = (newLifts: TrainingLift[]) => {
    setData((prev) => ({
      ...prev,
      training: {
        ...(prev.training || {}),
        [activeDayKey]: newLifts,
      },
    }));
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    const updated = currentDayLifts.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, name };
    });
    setLiftsForActiveDay(updated);
  };

  const addExercise = () => {
    const updated = [
      ...currentDayLifts,
      { name: '', weight: null, reps: null, sets: [{ weight: null, reps: null }] },
    ];
    setLiftsForActiveDay(updated);
  };

  const removeExercise = (exIdx: number) => {
    const updated = currentDayLifts.filter((_, i) => i !== exIdx);
    if (updated.length === 0) {
      updated.push({ name: '', weight: null, reps: null, sets: [{ weight: null, reps: null }] });
    }
    setLiftsForActiveDay(updated);
  };

  const addSet = (exIdx: number) => {
    const updated = currentDayLifts.map((ex, i) => {
      if (i !== exIdx) return ex;
      const curSets = ex.sets && ex.sets.length > 0 ? [...ex.sets] : [{ weight: ex.weight ?? null, reps: ex.reps ?? null }];
      const lastSet = curSets[curSets.length - 1];
      const newSet = {
        weight: lastSet?.weight ?? null,
        reps: lastSet?.reps ?? null,
      };
      return {
        ...ex,
        sets: [...curSets, newSet],
      };
    });
    setLiftsForActiveDay(updated);
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    const updated = currentDayLifts.map((ex, i) => {
      if (i !== exIdx) return ex;
      const curSets = ex.sets && ex.sets.length > 0 ? [...ex.sets] : [{ weight: ex.weight ?? null, reps: ex.reps ?? null }];
      if (curSets.length <= 1) return ex;
      const nextSets = curSets.filter((_, s) => s !== setIdx);
      return {
        ...ex,
        weight: nextSets[0]?.weight ?? null,
        reps: nextSets[0]?.reps ?? null,
        sets: nextSets,
      };
    });
    setLiftsForActiveDay(updated);
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: number | null) => {
    const updated = currentDayLifts.map((ex, i) => {
      if (i !== exIdx) return ex;
      const curSets = ex.sets && ex.sets.length > 0 ? [...ex.sets] : [{ weight: ex.weight ?? null, reps: ex.reps ?? null }];
      const nextSets = curSets.map((s, sIdx) => {
        if (sIdx !== setIdx) return s;
        return { ...s, [field]: value };
      });
      return {
        ...ex,
        weight: setIdx === 0 && field === 'weight' ? value : ex.weight ?? nextSets[0]?.weight ?? null,
        reps: setIdx === 0 && field === 'reps' ? value : ex.reps ?? nextSets[0]?.reps ?? null,
        sets: nextSets,
      };
    });
    setLiftsForActiveDay(updated);
  };

  // Core save executor for auto-save and manual save
  const executeSave = async (dataToSave: CheckinData, isAuto: boolean = false) => {
    if (!user) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    if (isAuto) {
      setAutoSaveStatus('saving');
    } else {
      setSaving(true);
      setAutoSaveStatus('saving');
    }

    try {
      const targetWeek = weekNumRef.current;
      const { error } = await supabase.from('checkins').upsert({
        user_id: user.id,
        week: targetWeek,
        data: dataToSave,
      }, { onConflict: 'user_id,week' });

      if (error) throw error;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(timeStr);
      setAutoSaveStatus('saved');
      isUserDirtyRef.current = false;

      refreshCheckins();

      if (!isAuto) {
        showToast(t('toast_week_saved', targetWeek));
      }
    } catch (err: any) {
      console.error('Save checkin error:', err);
      setAutoSaveStatus('error');
      if (!isAuto) {
        showToast(t('toast_save_failed'));
      }
    } finally {
      isSavingRef.current = false;
      if (!isAuto) {
        setSaving(false);
      }
    }
  };

  // Explicit manual save triggered by the Save Button
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await executeSave(dataRef.current, false);
  };

  // Safe week transition (flushes pending autosave before changing week)
  const handleWeekChange = async (targetWeek: number) => {
    if (targetWeek === weekNum) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (isUserDirtyRef.current) {
      await executeSave(dataRef.current, true);
    }
    router.push(`/checkin/${targetWeek}`);
  };

  const dayLabels = [
    { key: 'day1', label: t('day_mon') },
    { key: 'day2', label: t('day_tue') },
    { key: 'day3', label: t('day_wed') },
    { key: 'day4', label: t('day_thu') },
    { key: 'day5', label: t('day_fri') },
    { key: 'day6', label: t('day_sat') },
    { key: 'day7', label: t('day_sun') },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[var(--brown-dark)] px-5 py-2 text-xs font-extrabold text-white shadow-lg animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Week Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black text-[var(--brown-dark)]">
              {t('checkin_title')}
            </h1>
            {/* Auto-save status badge */}
            {autoSaveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-[var(--brown-dark)] border border-amber-500/30">
                <Loader2 size={11} className="animate-spin text-[var(--brown)]" />
                <span>{t('autosave_saving')}</span>
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
                <CheckCircle2 size={11} className="text-emerald-600" />
                <span>{t('autosave_saved')}</span>
              </span>
            )}
            {autoSaveStatus === 'unsaved' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>{t('autosave_unsaved')}</span>
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 border border-rose-500/30">
                <span>{t('autosave_error')}</span>
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[var(--muted)]">
            {t('checkin_sub', weekNum)}
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={weekNum <= 1}
            onClick={() => handleWeekChange(weekNum - 1)}
            className="btn secondary small disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <select
            value={weekNum}
            onChange={(e) => handleWeekChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-1.5 text-xs font-black text-[var(--brown-dark)] outline-none cursor-pointer"
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {t('weekOpt', w)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={weekNum >= 16}
            onClick={() => handleWeekChange(weekNum + 1)}
            className="btn secondary small disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION A: PHOTOS */}
          <div className="card space-y-3">
            <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
              {t('sec_photos')}
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['front', 'left', 'right', 'back'] as const).map((view) => {
                const label = t(`ph_${view}` as any);
                const hasPhoto = Boolean(data.photos?.[view]);
                const url = signedPhotoUrls[view];
                const isUploading = uploadingPhoto === view;

                return (
                  <div
                    key={view}
                    className="relative aspect-3/4 overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-[var(--cream-soft)] flex flex-col items-center justify-center p-2 text-center"
                  >
                    {url ? (
                      <>
                        <img
                          src={url}
                          alt={label}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-x-2 bottom-2 z-10 flex gap-1">
                          <label className="flex-1 cursor-pointer rounded-md bg-black/70 py-1 text-[10px] font-bold text-white hover:bg-black">
                            {t('ph_replace')}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handlePhotoUpload(view, f);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handlePhotoDelete(view)}
                            className="rounded-md bg-black/70 px-2 py-1 text-white hover:bg-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5">
                        {isUploading ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brown)] border-t-transparent" />
                        ) : (
                          <>
                            <Camera size={22} className="text-[var(--muted)]" />
                            <span className="text-[11px] font-bold text-[var(--muted)]">
                              {label}
                            </span>
                            <span className="text-[10px] text-[var(--brown)] underline">
                              {t('ph_upload')}
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePhotoUpload(view, f);
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION B: BODYWEIGHT */}
          <div className="card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-[var(--brown)] pb-1.5">
              <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase">
                {t('sec_bodyweight')}
              </h2>
              {weeklyAvgWeight !== null && (
                <div className="text-xs font-bold text-[var(--brown-dark)] mt-1 sm:mt-0">
                  {t('avgLbl')} <span className="font-black text-sm">{weeklyAvgWeight} kg</span>
                  {weightDeltaFromLastWeek !== null && (
                    <span
                      className={`ml-2 ${
                        weightDeltaFromLastWeek < 0
                          ? 'text-emerald-700'
                          : weightDeltaFromLastWeek > 0
                          ? 'text-amber-800'
                          : 'text-[var(--muted)]'
                      }`}
                    >
                      ({weightDeltaFromLastWeek > 0 ? `+${weightDeltaFromLastWeek}` : weightDeltaFromLastWeek} kg)
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dayLabels.map((d) => {
                const val = data.days?.[d.key]?.weight ?? '';
                return (
                  <div key={d.key} className="field text-center">
                    <label className="text-center font-extrabold">{d.label}</label>
                    <input
                      type="number"
                      step="0.1"
                      className="text-center font-bold"
                      value={val}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Number(e.target.value);
                        setData((prev) => ({
                          ...prev,
                          days: {
                            ...(prev.days || {}),
                            [d.key]: { weight: v },
                          },
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION C: MEASUREMENTS */}
          <div className="card space-y-4">
            <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
              {t('sec_measurements')}
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="field">
                <label>{t('m_waist')} *</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.waist ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      waist: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="80.0"
                />
              </div>
              <div className="field">
                <label>{t('m_hip')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.hips ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      hips: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="95.0"
                />
              </div>
              <div className="field">
                <label>{t('m_chest')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.chest ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      chest: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="100.0"
                />
              </div>
              <div className="field">
                <label>{t('m_armL')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.arm ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      arm: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="35.0"
                />
              </div>
              <div className="field">
                <label>{t('m_thighL')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.thigh ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      thigh: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="55.0"
                />
              </div>
            </div>
          </div>

          {/* SECTION D: NUTRITION */}
          <div className="card space-y-4">
            <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
              {t('sec_nutrition')}
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="field">
                <label>{t('n_cal')}</label>
                <input
                  type="number"
                  value={data.calories ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      calories: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="2200"
                />
              </div>
              <div className="field">
                <label>{t('n_protein')}</label>
                <input
                  type="number"
                  value={data.protein ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      protein: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="160"
                />
              </div>
              <div className="field">
                <label>{t('n_adherence')}</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={
                    typeof data.nutrition === 'number'
                      ? data.nutrition
                      : typeof (data.nutrition as any)?.adherenceDays === 'number'
                      ? (data.nutrition as any).adherenceDays
                      : typeof data.energy === 'number'
                      ? data.energy
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    setData({
                      ...data,
                      nutrition: val,
                      energy: val,
                    });
                  }}
                  placeholder="7"
                />
              </div>
            </div>
          </div>

          {/* SECTION E: TRAINING LOG (DYNAMIC EXERCISES & MULTI-SETS) */}
          <div className="card space-y-4">
            <div className="border-b-2 border-[var(--brown)] pb-1.5 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase">
                  {t('sec_training')}
                </h2>
                <p className="text-[11px] font-semibold text-[var(--muted)] mt-0.5">
                  {t('tapDayHint')}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black text-[var(--brown-dark)] bg-[var(--cream)] px-2.5 py-1 rounded-full border border-[var(--border)]">
                <Dumbbell size={12} className="text-[var(--brown)]" />
                <span>
                  {currentDayLifts.filter((l) => l.name?.trim()).length}{' '}
                  {language === 'th' ? 'ท่าที่บันทึกแล้ว' : 'exercises'}
                </span>
              </div>
            </div>

            {/* Day tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {dayLabels.map((d) => {
                const rawLifts = data.training?.[d.key];
                const count = Array.isArray(rawLifts)
                  ? rawLifts.filter(
                      (s) =>
                        s &&
                        (s.name?.trim() ||
                          s.weight ||
                          s.reps ||
                          (s.sets && s.sets.some((st) => st && (st.weight !== null || st.reps !== null))))
                    ).length
                  : 0;
                const isActive = activeDayKey === d.key;

                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActiveDayKey(d.key)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white shadow-xs'
                        : 'border-[var(--border)] bg-[var(--paper-light)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                    }`}
                  >
                    <span>{d.label}</span>
                    {count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                          isActive
                            ? 'bg-white text-[var(--brown-dark)]'
                            : 'bg-[var(--cream)] text-[var(--brown-dark)]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Exercises List for active day */}
            <div className="space-y-3.5">
              {currentDayLifts.map((exercise, exIdx) => {
                const sets =
                  exercise.sets && exercise.sets.length > 0
                    ? exercise.sets
                    : [{ weight: exercise.weight ?? null, reps: exercise.reps ?? null }];

                return (
                  <div
                    key={exIdx}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--paper-light)] p-3 sm:p-4 space-y-3 shadow-xs transition-all hover:border-[var(--brown)]/40"
                  >
                    {/* Exercise Card Header */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--brown-dark)] text-white text-xs font-black shadow-xs">
                        #{exIdx + 1}
                      </div>

                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs sm:text-sm font-bold text-[var(--brown-dark)] placeholder:text-[var(--muted)]/50 placeholder:font-normal outline-none focus:border-[var(--brown)] focus:ring-1 focus:ring-[var(--brown)]/20 transition-all"
                          placeholder={
                            language === 'th'
                              ? 'ระบุชื่อท่าฝึก (เช่น Bench Press, Squat, Lat Pulldown)'
                              : 'Exercise name (e.g. Bench Press)'
                          }
                          value={exercise.name || ''}
                          onChange={(e) => updateExerciseName(exIdx, e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeExercise(exIdx)}
                        title={language === 'th' ? 'ลบท่านี้' : 'Delete exercise'}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Sets Table */}
                    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-1.5 bg-[var(--cream-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                        <div className="col-span-2 text-center">SET</div>
                        <div className="col-span-4 text-center">กก. (KG)</div>
                        <div className="col-span-4 text-center">ครั้ง (REPS)</div>
                        <div className="col-span-2 text-center"></div>
                      </div>

                      {/* Sets Rows */}
                      <div className="divide-y divide-[var(--border)]/60">
                        {sets.map((st, sIdx) => (
                          <div
                            key={sIdx}
                            className="grid grid-cols-12 gap-1.5 items-center px-3 py-2 hover:bg-[var(--cream-soft)]/30 transition-colors"
                          >
                            {/* Set Number */}
                            <div className="col-span-2 flex justify-center">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--cream)] text-[11px] font-black text-[var(--brown-dark)]">
                                {sIdx + 1}
                              </span>
                            </div>

                            {/* KG Input */}
                            <div className="col-span-4">
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-center text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--brown)] focus:bg-[var(--cream-soft)]/20"
                                  placeholder="0"
                                  value={st.weight ?? ''}
                                  onChange={(e) =>
                                    updateSet(
                                      exIdx,
                                      sIdx,
                                      'weight',
                                      e.target.value === '' ? null : Number(e.target.value)
                                    )
                                  }
                                />
                                <span className="pointer-events-none absolute right-2 text-[10px] font-bold text-[var(--muted)] hidden min-[360px]:inline">
                                  kg
                                </span>
                              </div>
                            </div>

                            {/* Reps Input */}
                            <div className="col-span-4">
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-center text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--brown)] focus:bg-[var(--cream-soft)]/20"
                                  placeholder="0"
                                  value={st.reps ?? ''}
                                  onChange={(e) =>
                                    updateSet(
                                      exIdx,
                                      sIdx,
                                      'reps',
                                      e.target.value === '' ? null : Number(e.target.value)
                                    )
                                  }
                                />
                                <span className="pointer-events-none absolute right-2 text-[10px] font-bold text-[var(--muted)] hidden min-[360px]:inline">
                                  reps
                                </span>
                              </div>
                            </div>

                            {/* Delete Set */}
                            <div className="col-span-2 flex justify-center">
                              {sets.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeSet(exIdx, sIdx)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title={language === 'th' ? 'ลบเซ็ตนี้' : 'Delete set'}
                                >
                                  <X size={13} />
                                </button>
                              ) : (
                                <span className="w-6" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add Set Button */}
                    <div className="flex justify-start pt-0.5">
                      <button
                        type="button"
                        onClick={() => addSet(exIdx)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--brown)]/60 bg-[var(--cream-soft)] px-3 py-1.5 text-xs font-black text-[var(--brown-dark)] hover:bg-[var(--cream)] hover:border-[var(--brown)] transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus size={13} />
                        <span>{language === 'th' ? '+ เพิ่มเซ็ต' : '+ Add Set'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Exercise Button */}
            <button
              type="button"
              onClick={addExercise}
              className="w-full rounded-2xl border-2 border-dashed border-[var(--brown)]/40 bg-[var(--cream-soft)]/50 py-3.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-[var(--brown-dark)] hover:bg-[var(--cream)] hover:border-[var(--brown)] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brown-dark)] text-white group-hover:scale-110 transition-transform">
                <Plus size={14} />
              </div>
              <span>{language === 'th' ? '+ เพิ่มท่าฝึก' : '+ Add Exercise'}</span>
            </button>
          </div>

          {/* SECTION F: ACTIVITY & RECOVERY */}
          <div className="card space-y-4">
            <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
              {t('sec_activity')} & {t('sec_recovery')}
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="field">
                <label>{t('act_steps')}</label>
                <input
                  type="number"
                  value={data.steps ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      steps: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="8500"
                />
              </div>
              <div className="field">
                <label>{t('act_cardioMin')}</label>
                <input
                  type="number"
                  value={data.cardio ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      cardio: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="120"
                />
              </div>
              <div className="field">
                <label>{t('rec_sleepHours')}</label>
                <input
                  type="number"
                  step="0.5"
                  value={data.sleep ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      sleep: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="7.5"
                />
              </div>
              <div className="field">
                <label>{t('rec_stress')}</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={data.stress ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      stress: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="2"
                />
              </div>
            </div>
          </div>

          {/* SECTION H: REFLECTION */}
          <div className="card space-y-4">
            <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
              {t('sec_reflection')}
            </h2>

            <div className="field">
              <label>{t('ref_coach')}</label>
              <textarea
                rows={3}
                value={data.notes || ''}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
                placeholder="Updates, questions, or comments for this week..."
              />
            </div>
          </div>

          {/* Save & Auto-save Action Bar */}
          <div className="sticky bottom-16 sm:bottom-6 z-20">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-light)]/95 backdrop-blur-md p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold w-full sm:w-auto justify-center sm:justify-start">
                {autoSaveStatus === 'saving' && (
                  <span className="flex items-center gap-2 text-[var(--brown-dark)] bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30">
                    <Loader2 size={13} className="animate-spin text-[var(--brown)]" />
                    <span>{t('autosave_saving')}</span>
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="flex items-center gap-2 text-emerald-700 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>{t('autosave_saved')}{lastSavedTime ? ` (${lastSavedTime})` : ''}</span>
                  </span>
                )}
                {autoSaveStatus === 'unsaved' && (
                  <span className="flex items-center gap-2 text-amber-700 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>{t('autosave_unsaved')}</span>
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="flex items-center gap-2 text-rose-700 bg-rose-500/10 px-3.5 py-1.5 rounded-full border border-rose-500/30">
                    <span>{t('autosave_error')}</span>
                  </span>
                )}
                {autoSaveStatus === 'idle' && (
                  <span className="flex items-center gap-2 text-[var(--muted)] px-1 py-1">
                    {lastSavedTime ? (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>{t('autosave_saved')} ({lastSavedTime})</span>
                      </>
                    ) : (
                      <>
                        <Cloud size={13} className="text-[var(--muted)]" />
                        <span>{language === 'th' ? 'ระบบบันทึกอัตโนมัติเปิดใช้งานอยู่' : 'Auto-save is active'}</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Explicit Save Button */}
              <button
                type="submit"
                disabled={saving || isSavingRef.current}
                className="btn primary w-full sm:w-auto shadow-md flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black cursor-pointer shrink-0"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>{language === 'th' ? 'กำลังบันทึก...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>{t('saveWeek', weekNum)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}

