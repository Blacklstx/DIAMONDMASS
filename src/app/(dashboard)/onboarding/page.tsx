'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { GoalType, GENDER_OPTIONS } from '@/types/database';

export default function OnboardingPage() {
  const { user, profile, isAdmin, refreshProfile, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && isAdmin) {
      router.replace('/admin');
    }
  }, [authLoading, isAdmin, router]);

  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('male');
  const [customGender, setCustomGender] = useState('');
  const [height, setHeight] = useState<number | ''>('');
  const [goal, setGoal] = useState<GoalType>('cutting');
  const [startWeight, setStartWeight] = useState<number | ''>('');
  const [targetWeight, setTargetWeight] = useState<number | ''>('');
  const [startWaist, setStartWaist] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainingDays, setTrainingDays] = useState<number | ''>(16);
  const [stepsTarget, setStepsTarget] = useState<number | ''>(8000);
  const [calorieTarget, setCalorieTarget] = useState<number | ''>('');
  const [proteinTarget, setProteinTarget] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setAge(profile.age || '');
      if (profile.gender) {
        const isStandard = GENDER_OPTIONS.some((o) => o.value === profile.gender);
        if (isStandard) {
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
      setHeight(profile.height || '');
      setGoal(profile.goal || 'cutting');
      setStartWeight(profile.start_weight || '');
      setTargetWeight(profile.target_weight || '');
      setStartWaist(profile.start_waist || '');
      setStartDate(profile.start_date || new Date().toISOString().split('T')[0]);
      setTrainingDays(profile.training_days || 16);
      setStepsTarget(profile.steps_target || 8000);
      setCalorieTarget(profile.calorie_target || '');
      setProteinTarget(profile.protein_target || '');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');
    setLoading(true);

    try {
      // 1. Update basic identity in profiles table (stores only email, name, gender, role)
      const finalGender = gender === 'other' && customGender.trim() ? customGender.trim() : gender;
      await supabase
        .from('profiles')
        .update({
          name: name || null,
          gender: finalGender,
        })
        .eq('id', user.id);

      // 2. Save all fitness metrics into dedicated trainee_profiles table
      const traineePayload = {
        user_id: user.id,
        goal,
        start_date: startDate,
        start_weight: startWeight === '' ? null : Number(startWeight),
        target_weight: targetWeight === '' ? null : Number(targetWeight),
        start_waist: startWaist === '' ? null : Number(startWaist),
        age: age === '' ? null : Number(age),
        height: height === '' ? null : Number(height),
        training_days: trainingDays === '' ? 16 : Number(trainingDays),
        steps_target: stepsTarget === '' ? 8000 : Number(stepsTarget),
        calorie_target: calorieTarget === '' ? null : Number(calorieTarget),
        protein_target: proteinTarget === '' ? null : Number(proteinTarget),
        allow_future_checkins: true,
        updated_at: new Date().toISOString(),
      };

      const { error: tErr } = await supabase
        .from('trainee_profiles')
        .upsert(traineePayload, { onConflict: 'user_id' });

      if (tErr) throw tErr;

      // Ensure week 1 exists with initial data
      if (startWeight || startWaist) {
        await supabase.from('checkins').upsert({
          user_id: user.id,
          week: 1,
          data: {
            days: {
              day1: { weight: startWeight === '' ? null : Number(startWeight) },
            },
            waist: startWaist === '' ? null : Number(startWaist),
          },
        }, { onConflict: 'user_id,week' });
      }

      await refreshProfile();
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || t('toast_save_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="card">
        <div className="mb-6 text-center">
          <div className="relative mx-auto mb-3 h-12 w-12">
            <Image src="/logo.png" alt="DiamondMass" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-black text-[var(--brown-dark)]">
            {profile?.start_weight ? t('ob_title_edit') : t('ob_title')}
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {profile?.start_weight ? t('ob_sub_edit') : t('ob_sub')}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>{t('ob_name')}</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              <label>{t('ob_gender')}</label>
              <select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  if (e.target.value !== 'other') setCustomGender('');
                }}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'th' ? opt.labelTh : opt.labelEn}
                  </option>
                ))}
              </select>
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

          {/* Goal Selector */}
          <div className="field">
            <label>{t('ob_goal')}</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setGoal('cutting')}
                className={`flex-1 rounded-xl border p-3 text-center text-xs font-extrabold transition-all ${
                  goal === 'cutting'
                    ? 'border-[var(--brown)] bg-[var(--cream-soft)] text-[var(--brown-dark)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                }`}
              >
                {t('goal_cutting')}
              </button>
              <button
                type="button"
                onClick={() => setGoal('bulking')}
                className={`flex-1 rounded-xl border p-3 text-center text-xs font-extrabold transition-all ${
                  goal === 'bulking'
                    ? 'border-[var(--beige)] bg-[var(--cream)] text-[var(--brown-dark)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
                }`}
              >
                {t('goal_bulking')}
              </button>
            </div>
          </div>

          {/* Weight & Waist */}
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('ob_startWeight')}</label>
              <input
                type="number"
                step="0.1"
                required
                value={startWeight}
                onChange={(e) => setStartWeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="75.0"
              />
            </div>
            <div className="field">
              <label>{t('ob_targetWeight')}</label>
              <input
                type="number"
                step="0.1"
                required
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="70.0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('ob_startWaist')}</label>
              <input
                type="number"
                step="0.1"
                required
                value={startWaist}
                onChange={(e) => setStartWaist(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="85.0"
              />
            </div>
            <div className="field">
              <label>{t('ob_startDate')}</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('ob_trainingDays')}</label>
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
            <div className="field">
              <label>{t('ob_stepsTarget')}</label>
              <input
                type="number"
                value={stepsTarget}
                onChange={(e) => setStepsTarget(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="8000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>{t('ob_calorieTarget')}</label>
              <input
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="2000"
              />
            </div>
            <div className="field">
              <label>{t('ob_proteinTarget')}</label>
              <input
                type="number"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="150"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn primary w-full mt-4">
            {loading ? '...' : profile?.start_weight ? t('ob_submit_edit') : t('ob_submit')}
          </button>
        </form>
      </div>
    </div>
  );
}

