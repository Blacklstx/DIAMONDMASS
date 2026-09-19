'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

export default function CheckinPage() {
  const params = useParams();
  const weekParam = params?.week as string;
  const weekNum = Math.min(16, Math.max(1, parseInt(weekParam, 10) || 1));

  const { user, profile, checkins, currentWeek, refreshCheckins, getWeekStatus } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  // Active checkin data state
  const existingCheckin = checkins.find((c) => c.week === weekNum);
  const [data, setData] = useState<CheckinData>({});
  const [activeDayKey, setActiveDayKey] = useState<string>('day1');
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Initialize form state from database
  useEffect(() => {
    if (existingCheckin?.data) {
      setData(existingCheckin.data);
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
  }, [existingCheckin, weekNum]);

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

  // Training log lifts for active day
  const currentDayLifts = data.training?.[activeDayKey] || [];

  const updateLift = (index: number, field: keyof TrainingLift, value: any) => {
    const lifts = [...currentDayLifts];
    if (!lifts[index]) {
      lifts[index] = { name: '', weight: null, reps: null };
    }
    lifts[index] = { ...lifts[index], [field]: value };
    setData((prev) => ({
      ...prev,
      training: {
        ...(prev.training || {}),
        [activeDayKey]: lifts,
      },
    }));
  };

  // Save full check-in
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('checkins').upsert({
        user_id: user.id,
        week: weekNum,
        data,
      }, { onConflict: 'user_id,week' });

      if (error) throw error;

      await refreshCheckins();
      showToast(t('toast_week_saved', weekNum));
    } catch (err: any) {
      console.error(err);
      showToast(t('toast_save_failed'));
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-black text-[var(--brown-dark)]">
            {t('checkin_title')}
          </h1>
          <p className="text-xs font-bold text-[var(--muted)]">
            {t('checkin_sub', weekNum)}
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={weekNum <= 1}
            onClick={() => router.push(`/checkin/${weekNum - 1}`)}
            className="btn secondary small disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <select
            value={weekNum}
            onChange={(e) => router.push(`/checkin/${e.target.value}`)}
            className="rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-1.5 text-xs font-black text-[var(--brown-dark)] outline-none"
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
            onClick={() => router.push(`/checkin/${weekNum + 1}`)}
            className="btn secondary small disabled:opacity-30"
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
                  value={data.energy ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      energy: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="7"
                />
              </div>
            </div>
          </div>

          {/* SECTION E: TRAINING LOG (7-DAY TABS x 10 LIFTS) */}
          <div className="card space-y-4">
            <div className="border-b-2 border-[var(--brown)] pb-1.5">
              <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase">
                {t('sec_training')}
              </h2>
              <p className="text-[11px] font-semibold text-[var(--muted)] mt-0.5">
                {t('tapDayHint')}
              </p>
            </div>

            {/* Day tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {dayLabels.map((d) => {
                const rawLifts = data.training?.[d.key];
                const count = Array.isArray(rawLifts)
                  ? rawLifts.filter((s) => s && (s?.name || s?.weight || s?.reps)).length
                  : 0;
                const isActive = activeDayKey === d.key;

                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActiveDayKey(d.key)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      isActive
                        ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white'
                        : 'border-[var(--border)] bg-[var(--paper-light)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                    }`}
                  >
                    <span>{d.label}</span>
                    {count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                          isActive ? 'bg-white text-[var(--brown-dark)]' : 'bg-[var(--cream)] text-[var(--brown-dark)]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Lift rows (up to 10) */}
            <div className="space-y-2 pt-1">
              {Array.from({ length: 10 }, (_, i) => {
                const lift = currentDayLifts[i] || { name: '', weight: null, reps: null };

                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-center text-[10px] font-black text-[var(--muted)]">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      className="flex-2 rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--brown)]"
                      placeholder={t('liftName')}
                      value={lift.name || ''}
                      onChange={(e) => updateLift(i, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.5"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--brown)]"
                      placeholder="kg"
                      value={lift.weight ?? ''}
                      onChange={(e) =>
                        updateLift(i, 'weight', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--paper-light)] px-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--brown)]"
                      placeholder="reps"
                      value={lift.reps ?? ''}
                      onChange={(e) =>
                        updateLift(i, 'reps', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </div>
                );
              })}
            </div>
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

          {/* Save Button */}
          <div className="sticky bottom-16 sm:bottom-6 z-20">
            <button
              type="submit"
              disabled={saving}
              className="btn primary w-full shadow-lg flex items-center justify-center gap-2 py-3 text-sm"
            >
              <Save size={16} />
              <span>{saving ? '...' : t('saveWeek', weekNum)}</span>
            </button>
          </div>
        </form>
    </div>
  );
}

