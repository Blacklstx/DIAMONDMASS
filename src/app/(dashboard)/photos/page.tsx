'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { Camera, ChevronRight } from 'lucide-react';

type PhotoView = 'all' | 'front' | 'left' | 'right' | 'back';

export default function PhotosPage() {
  const { user, checkins } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [activeView, setActiveView] = useState<PhotoView>('front');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const views: { id: PhotoView; label: string }[] = [
    { id: 'front', label: t('ph_front') },
    { id: 'left', label: t('ph_left') },
    { id: 'right', label: t('ph_right') },
    { id: 'back', label: t('ph_back') },
    { id: 'all', label: 'ALL VIEWS' },
  ];

  useEffect(() => {
    if (!user) return;

    async function loadAllPhotos() {
      setLoading(true);
      const urls: Record<string, string> = {};
      const checkinPhotosList: { week: number; view: string }[] = [];

      checkins.forEach((c) => {
        const photos = c.data?.photos;
        if (photos) {
          (['front', 'left', 'right', 'back'] as const).forEach((v) => {
            if (photos[v]) {
              checkinPhotosList.push({ week: c.week, view: v });
            }
          });
        }
      });

      for (const item of checkinPhotosList) {
        const padWeek = String(item.week).padStart(2, '0');
        const path = `${user?.id}/week-${padWeek}/${item.view}.jpg`;
        const { data } = await supabase.storage
          .from('progress-photos')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          urls[`${item.week}_${item.view}`] = data.signedUrl;
        }
      }

      setPhotoUrls(urls);
      setLoading(false);
    }

    loadAllPhotos();
  }, [user, checkins]);

  // Weeks with photos
  const weeksWithPhotos = Array.from({ length: 16 }, (_, i) => i + 1).filter((w) => {
    const c = checkins.find((x) => x.week === w);
    if (!c?.data?.photos) return false;
    if (activeView === 'all') {
      return Object.values(c.data.photos).some(Boolean);
    }
    return Boolean(c.data.photos[activeView]);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--brown-dark)]">
          {t('photos_title')}
        </h1>
        <p className="text-xs font-bold text-[var(--muted)]">
          {t('photos_sub')}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActiveView(v.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              activeView === v.id
                ? 'bg-[var(--brown-dark)] text-white'
                : 'border border-[var(--border)] bg-[var(--paper-light)] text-[var(--muted)] hover:bg-[var(--cream-soft)]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brown)]" />
        </div>
      ) : weeksWithPhotos.length === 0 ? (
        <div className="card text-center py-16">
          <Camera size={36} className="mx-auto text-[var(--muted)] mb-3" />
          <h3 className="text-sm font-black text-[var(--brown-dark)] mb-1">
            No photos yet for this angle
          </h3>
          <p className="text-xs text-[var(--muted)] mb-4">
            Upload progress photos in your weekly check-ins to track physical changes.
          </p>
          <Link href="/checkin/1" className="btn primary small">
            Go to Check-in
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {weeksWithPhotos.map((w) => {
            const c = checkins.find((x) => x.week === w);
            const viewToDisplay = activeView === 'all' ? 'front' : activeView;
            const imgUrl = photoUrls[`${w}_${viewToDisplay}`];

            const days = c?.data?.days || {};
            const weights = Object.values(days)
              .map((d) => d?.weight)
              .filter((v): v is number => v !== null && v !== undefined);
            const avgWeight =
              weights.length > 0
                ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10
                : null;

            return (
              <Link
                key={w}
                href={`/checkin/${w}`}
                className="card group overflow-hidden p-3 transition-transform hover:-translate-y-0.5"
              >
                <div className="relative aspect-3/4 w-full overflow-hidden rounded-lg bg-[var(--cream-soft)] mb-2">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={`Week ${w} - ${viewToDisplay}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--muted)]">
                      No Photo
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[var(--brown-dark)]">
                    {t('weekLbl', w)}
                  </span>
                  <ChevronRight size={14} className="text-[var(--muted)]" />
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-[var(--muted)]">
                  <span>{avgWeight ? `${avgWeight} kg` : '—'}</span>
                  <span>{c?.data?.waist ? `${c.data.waist} cm` : '—'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

