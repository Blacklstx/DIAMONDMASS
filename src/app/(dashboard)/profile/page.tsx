'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  ShieldCheck,
  ChevronRight,
  Flame,
  Dumbbell,
} from 'lucide-react';
import { GoalType, GENDER_OPTIONS } from '@/types/database';

export default function ProfilePage() {
  const { user, profile, refreshProfile, logout, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [gender, setGender] = useState('male');
  const [customGender, setCustomGender] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [goal, setGoal] = useState<GoalType>('cutting');
  const [startWeight, setStartWeight] = useState<number | ''>('');
  const [targetWeight, setTargetWeight] = useState<number | ''>('');
  const [startWaist, setStartWaist] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
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
      if (profile.gender) {
        const isStd = GENDER_OPTIONS.some((o) => o.value === profile.gender);
        if (isStd) {
          setGender(profile.gender);
          setCustomGender('');
        } else {
          setGender('other');
          setCustomGender(profile.gender);
        }
      } else {
        setGender('male');
        setCustomGender('');
      }
      setAge(profile.age || '');
      setHeight(profile.height || '');
      setGoal(profile.goal || 'cutting');
      setStartWeight(profile.start_weight || '');
      setStartWaist(profile.start_waist || '');
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
      const finalGender = gender === 'other' && customGender.trim() ? customGender.trim() : gender;

      // 1. Update basic account identity in profiles
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          name: name || null,
          gender: finalGender,
        })
        .eq('id', user.id);

      if (pErr) throw pErr;

      // 2. If trainee, update all fitness metrics in trainee_profiles
      if (!isAdmin) {
        const { error: tErr } = await supabase
          .from('trainee_profiles')
          .upsert({
            user_id: user.id,
            goal,
            start_date: startDate || null,
            start_weight: startWeight === '' ? null : Number(startWeight),
            target_weight: targetWeight === '' ? null : Number(targetWeight),
            start_waist: startWaist === '' ? null : Number(startWaist),
            age: age === '' ? null : Number(age),
            height: height === '' ? null : Number(height),
            training_days: trainingDays === '' ? 16 : Number(trainingDays),
            calorie_target: calorieTarget === '' ? null : Number(calorieTarget),
            protein_target: proteinTarget === '' ? null : Number(proteinTarget),
            steps_target: stepsTarget === '' ? 8000 : Number(stepsTarget),
            cardio_target: cardioTarget === '' ? null : Number(cardioTarget),
            allow_future_checkins: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (tErr) throw tErr;

        // Keep Week 1 checkin day1 weight & waist in sync
        if (startWeight || startWaist) {
          const { data: w1 } = await supabase
            .from('checkins')
            .select('data')
            .eq('user_id', user.id)
            .eq('week', 1)
            .maybeSingle();

          const curData = w1?.data || {};
          const curDays = curData.days || {};
          await supabase.from('checkins').upsert({
            user_id: user.id,
            week: 1,
            data: {
              ...curData,
              days: {
                ...curDays,
                day1: { weight: startWeight === '' ? null : Number(startWeight) },
              },
              waist: startWaist === '' ? null : Number(startWaist),
            },
          }, { onConflict: 'user_id,week' });
        }
      }

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
      .from('trainee_profiles')
      .update({ coach_share_active: nextState })
      .eq('user_id', user.id);

    await refreshProfile();
    showToast(t('toast_saved'));
  };

  const regenerateCoachToken = async () => {
    if (!user) return;
    const newToken = crypto.randomUUID();

    await supabase
      .from('trainee_profiles')
      .update({ coach_token: newToken, coach_share_active: true })
      .eq('user_id', user.id);

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
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Section 1: Personal Info */}
          <div>
            <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5 mb-3">
              {language === 'th' ? '1. ข้อมูลส่วนตัว' : '1. Personal Information'}
            </h2>
            <div className="space-y-3">
              <div className="field">
                <label>{t('p_name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="field">
                  <label>{t('ob_gender')}</label>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value);
                      if (e.target.value !== 'other') setCustomGender('');
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--brown)] cursor-pointer"
                  >
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {language === 'th' ? opt.labelTh : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{t('ob_age')}</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="28"
                  />
                </div>

                <div className="field">
                  <label>{t('ob_height')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={height}
                    onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="175"
                  />
                </div>
              </div>

              {gender === 'other' && (
                <div className="field animate-fade-in">
                  <label>{language === 'th' ? 'ระบุเพศของคุณ' : 'Specify your gender'}</label>
                  <input
                    type="text"
                    value={customGender}
                    onChange={(e) => setCustomGender(e.target.value)}
                    placeholder={language === 'th' ? 'โปรดระบุเพศของคุณ...' : 'Please specify...'}
                  />
                </div>
              )}
            </div>
          </div>

          {!isAdmin && (
            <>
              {/* Section 2: Program & Goal */}
              <div>
                <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5 mb-3">
                  {language === 'th' ? '2. โปรแกรมและเป้าหมาย' : '2. Program & Goals'}
                </h2>
                <div className="space-y-3">
                  <div className="field">
                    <label>{t('ob_goal')}</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setGoal('cutting')}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-black transition-all cursor-pointer ${
                          goal === 'cutting'
                            ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white shadow-sm'
                            : 'border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                        }`}
                      >
                        <Flame size={14} />
                        <span>{t('goal_cutting')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoal('bulking')}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-black transition-all cursor-pointer ${
                          goal === 'bulking'
                            ? 'border-[var(--brown-dark)] bg-[var(--brown-dark)] text-white shadow-sm'
                            : 'border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                        }`}
                      >
                        <Dumbbell size={14} />
                        <span>{t('goal_bulking')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="field">
                      <label>{t('p_startDate')}</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
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
                </div>
              </div>

              {/* Section 3: Weight & Measurements */}
              <div>
                <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5 mb-3">
                  {language === 'th' ? '3. น้ำหนักและสัดส่วน' : '3. Weight & Measurements'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="field">
                    <label>{t('ob_startWeight')}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={startWeight}
                      onChange={(e) => setStartWeight(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="75.0"
                    />
                  </div>
                  <div className="field">
                    <label>{t('p_targetWeight')}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="70.0"
                    />
                  </div>
                  <div className="field">
                    <label>{t('ob_startWaist')}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={startWaist}
                      onChange={(e) => setStartWaist(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="85.0"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Nutrition & Activity Targets */}
              <div>
                <h2 className="text-xs font-black tracking-widest text-[var(--brown-dark)] uppercase border-b-2 border-[var(--brown)] pb-1.5 mb-3">
                  {language === 'th' ? '4. โภชนาการและกิจกรรม' : '4. Nutrition & Activity'}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label>{t('p_calorieTarget')}</label>
                    <input
                      type="number"
                      value={calorieTarget}
                      onChange={(e) => setCalorieTarget(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="2000"
                    />
                  </div>
                  <div className="field">
                    <label>{t('p_proteinTarget')}</label>
                    <input
                      type="number"
                      value={proteinTarget}
                      onChange={(e) => setProteinTarget(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="160"
                    />
                  </div>
                  <div className="field">
                    <label>{t('p_stepsTarget')}</label>
                    <input
                      type="number"
                      value={stepsTarget}
                      onChange={(e) => setStepsTarget(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="8000"
                    />
                  </div>
                  <div className="field">
                    <label>{t('p_cardioTarget')}</label>
                    <input
                      type="number"
                      value={cardioTarget}
                      onChange={(e) => setCardioTarget(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="120"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={saving} className="btn primary w-full mt-4 flex items-center justify-center gap-2 cursor-pointer">
            <Save size={15} />
            <span>{saving ? '...' : t('saveProfile')}</span>
          </button>
        </form>
      </div>

      {/* ADMIN PANEL SHORTCUT (ONLY FOR ADMINS) */}
      {isAdmin && (
        <div className="card bg-[var(--cream-soft)] border border-[var(--brown)]/30 flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brown-dark)] text-amber-300 shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="text-xs font-black tracking-wide text-[var(--brown-dark)]">
                {t('admin_title')}
              </div>
              <div className="text-[11px] text-[var(--muted)]">
                {t('admin_sub')}
              </div>
            </div>
          </div>
          <Link
            href="/admin"
            className="btn primary small flex items-center gap-1 text-xs shrink-0"
          >
            <span>{t('admin_view_detail')}</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

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

