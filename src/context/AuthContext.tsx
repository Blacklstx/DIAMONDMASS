'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Profile, Checkin } from '@/types/database';
import { useRouter } from 'next/navigation';

export type WeekStatusType = 'completed' | 'current' | 'locked' | 'missing-photos' | 'upcoming';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  checkins: Checkin[];
  loading: boolean;
  currentWeek: number;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  refreshCheckins: () => Promise<void>;
  logout: () => Promise<void>;
  getWeekStatus: (n: number) => WeekStatusType;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const supabase = createClient();

  const loadData = async (currentUser: User) => {
    try {
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      setProfile(pData);

      const { data: cData } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('week', { ascending: true });

      setCheckins(cData || []);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        setUser(session.user);
        await loadData(session.user);
      }
      if (mounted) setLoading(false);
    }

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await loadData(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setCheckins([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(data);
  };

  const refreshCheckins = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id)
      .order('week', { ascending: true });
    setCheckins(data || []);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCheckins([]);
    router.push('/login');
  };

  const getCurrentWeek = (): number => {
    let calWeek = 1;
    if (profile?.start_date) {
      const start = new Date(profile.start_date + 'T00:00:00');
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        calWeek = Math.floor(diffDays / 7) + 1;
      }
    }

    // Check highest week with logged check-in data
    const maxLoggedWeek = checkins.reduce((max, c) => {
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

    return Math.min(16, Math.max(1, Math.max(calWeek, maxLoggedWeek)));
  };

  const currentWeek = getCurrentWeek();

  const getWeekStatus = (n: number): WeekStatusType => {
    const cur = currentWeek;
    const c = checkins.find((x) => x.week === n);

    if (c && c.data) {
      const photos = c.data.photos;
      const hasPhotos = photos && (photos.front || photos.left || photos.right || photos.back);
      const hasDays = c.data.days && Object.values(c.data.days).some((d) => d.weight !== null && d.weight !== undefined);
      const hasAny = c.data.waist || hasDays || hasPhotos;
      if (hasAny) {
        if (!hasPhotos) return 'missing-photos';
        return 'completed';
      }
    }
    if (n === cur) return 'current';
    return 'upcoming';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        checkins,
        loading,
        currentWeek,
        isAdmin: profile?.role === 'admin',
        refreshProfile,
        refreshCheckins,
        logout,
        getWeekStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

