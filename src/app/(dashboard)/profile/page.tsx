'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { ShareCardModal } from '@/components/coach/ShareCardModal';
import {
  Share2,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Save,
  LogOut,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetWeight, setTargetWeight] = useState<number | ''>('');
  const [trainingDays, setTrainingDays] = useState<number | ''>(16);
  const [calorieTarget, setCalorieTarget] = useState<number | ''>('');
  const [proteinTarget, setProteinTarget] = useState<number | ''>('');
  const [stepsTarget, setStepsTarget] = useState<number | ''>(8000);
  const [cardioTarget, setCardioTarget] = useState<number | ''>('');

  const [saving, setSaving] = useState(false);
  const [coachActive, setCoachActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setStartDate(profile.start_date || new Date().toISOString().split('T')[0]);
      setTargetWeight(profile.target_weight || '');
      setTrainingDays(profile.training_days || 16);
      setCalorieTarget(profile.calorie_target || '');
      setProteinTarget(profile.protein_target || '');
      setStepsTarget(profile.steps_target || 8000);
      setCardioTarget(profile.cardio_target || '');
      setCoachActive(Boolean(profile.coach_share_active));
    }
  }, [profile]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name || null,
          start_date: startDate || null,
          target_weight: targetWeight === '' ? null : Number(targetWeight),
          training_days: trainingDays === '' ? 16 : Number(trainingDays),
          calorie_target: calorieTarget === '' ? null : Number(calorieTarget),
          protein_target: proteinTarget === '' ? null : Number(proteinTarget),
          steps_target: stepsTarget === '' ? 8000 : Number(stepsTarget),
          cardio_target: cardioTarget === '' ? null : Number(cardioTarget),
          allow_future_checkins: true,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      showToast(t('toast_profile_saved'));
    } catch (err: any) {
      console.error(err);
      showToast(t('toast_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleCoachShare = async () => {
    if (!user) return;
    const nextState = !coachActive;
    setCoachActive(nextState);

    await supabase
      .from('profiles')
      .update({ coach_share_active: nextState })
      .eq('id', user.id);
    await refreshProfile();
    showToast(t('toast_saved'));
  };

  const regenerateCoachToken = async () => {
    if (!user) return;
    const newToken = crypto.randomUUID();

    await supabase
      .from('profiles')
      .update({ coach_token: newToken, coach_share_active: true })
      .eq('id', user.id);
    setCoachActive(true);
    await refreshProfile();
    showToast('New coach link generated');
  };

  const coachUrl = typeof window !== 'undefined' && profile?.coach_token
    ? `${window.location.origin}/coach/${profile.coach_token}`
    : '';

  const copyCoachLink = () => {
    if (!coachUrl) return;
    navigator.clipboard.writeText(coachUrl);
    setCopied(true);
    showToast(t('toast_link_copied'));
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[var(--brown-dark)] px-5 py-2 text-xs font-extrabold text-white shadow-lg">
          {toastMsg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-[var(--brown-dark)]">
          {t('profile_title')}
        </h1>
        <p className="text-xs font-bold text-[var(--muted)]">
          Manage your targets, coach share, and preferences
        </p>
      </div>

      {/* Target Settings Form */}
      <div className="card">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5">
            Targets & Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <label>{t('p_name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="field">
              <label>{t('p_startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('p_targetWeight')}</label>
              <input
                type="number"
                step="0.1"
                value={targetWeight}
                onChange={(e) =>
                  setTargetWeight(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="70.0"
              />
            </div>
            <div className="field">
              <label>{t('p_trainingDays')}</label>
              <input
                type="number"
                min="1"
                max="16"
                value={trainingDays}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setTrainingDays('');
                  } else {
                    const val = Number(e.target.value);
                    setTrainingDays(Math.min(16, Math.max(1, val)));
                  }
                }}
                placeholder="16"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('p_calorieTarget')}</label>
              <input
                type="number"
                value={calorieTarget}
                onChange={(e) =>
                  setCalorieTarget(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="2000"
              />
            </div>
            <div className="field">
              <label>{t('p_proteinTarget')}</label>
              <input
                type="number"
                value={proteinTarget}
                onChange={(e) =>
                  setProteinTarget(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="160"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('p_stepsTarget')}</label>
              <input
                type="number"
                value={stepsTarget}
                onChange={(e) =>
                  setStepsTarget(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="8000"
              />
            </div>
            <div className="field">
              <label>{t('p_cardioTarget')}</label>
              <input
                type="number"
                value={cardioTarget}
                onChange={(e) =>
                  setCardioTarget(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="120"
              />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn primary w-full mt-2 flex items-center justify-center gap-2">
            <Save size={15} />
            <span>{saving ? '...' : t('saveProfile')}</span>
          </button>
        </form>
      </div>

      {/* COACH SHARE SECTION */}
      <div className="card space-y-4">
        <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5 flex items-center gap-2">
          <Share2 size={16} />
          <span>{t('coachshare_title')}</span>
        </h2>

        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t('coachshare_p1')}
        </p>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream-soft)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[var(--brown-dark)]">
              {coachActive ? t('coachLinkActive') : t('coachLinkInactive')}
            </span>
            <button
              type="button"
              onClick={toggleCoachShare}
              className={`btn small ${coachActive ? 'secondary' : 'primary'}`}
            >
              {coachActive ? t('coachLinkToggleOff') : t('coachLinkToggleOn')}
            </button>
          </div>

          {coachActive && (
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={coachUrl}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-mono text-[var(--text)] outline-none"
                />
                <button
                  type="button"
                  onClick={copyCoachLink}
                  className="btn primary small flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : t('copyLink')}</span>
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={regenerateCoachToken}
                  className="text-[11px] font-bold text-[var(--brown)] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>{t('regenerateLink')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Share Card Modal Trigger */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="btn secondary w-full flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            <span>{t('shareProgressCard')}</span>
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={logout}
          className="text-xs font-bold text-[var(--brown)] hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
        >
          <LogOut size={14} />
          <span>{t('logout')}</span>
        </button>
      </div>

      {/* Share Progress Card Modal */}
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
}

