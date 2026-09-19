'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { X, Download } from 'lucide-react';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareCardModal({ isOpen, onClose }: ShareCardModalProps) {
  const { user, profile, checkins, currentWeek } = useAuth();
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen || !profile || !user) return;
    const currentProfile = profile;
    const currentUser = user;

    async function draw() {
      setRendering(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;

      // 1. Background
      ctx.fillStyle = '#F7F3E8';
      ctx.fillRect(0, 0, W, H);

      // Decorative top & bottom banners
      ctx.fillStyle = '#33271E';
      ctx.fillRect(0, 0, W, 120);

      // 2. Header Brand
      ctx.fillStyle = '#FFFDF7';
      ctx.font = '900 36px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DIAMONDMASS 16-WEEK TRANSFORMATION', W / 2, 75);

      // Subtitle
      ctx.fillStyle = '#33271E';
      ctx.font = '900 48px Inter, sans-serif';
      ctx.fillText(currentProfile.name || 'My Progress', W / 2, 220);

      ctx.fillStyle = '#756A5D';
      ctx.font = '700 28px Inter, sans-serif';
      const goalStr = currentProfile.goal === 'bulking' ? 'BULKING PROGRAM' : 'CUTTING PROGRAM';
      ctx.fillText(`WEEK ${currentWeek} OF 16 • ${goalStr}`, W / 2, 270);

      // 3. Stat Highlights
      const startW = currentProfile.start_weight || 0;
      const curW = checkins[checkins.length - 1]?.data?.days?.day1?.weight || startW;
      const deltaW = Math.round((curW - startW) * 10) / 10;
      const deltaWStr = deltaW > 0 ? `+${deltaW} kg` : `${deltaW} kg`;

      const startWaist = currentProfile.start_waist || 0;
      const curWaist = checkins[checkins.length - 1]?.data?.waist || startWaist;
      const deltaWaist = Math.round((curWaist - startWaist) * 10) / 10;
      const deltaWaistStr = deltaWaist > 0 ? `+${deltaWaist} cm` : `${deltaWaist} cm`;

      // Stat Card 1
      ctx.fillStyle = '#FFFDF7';
      ctx.strokeStyle = '#DDD2BD';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(100, 330, 410, 200, [20]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#756A5D';
      ctx.font = '800 24px Inter, sans-serif';
      ctx.fillText('WEIGHT CHANGE', 305, 390);

      ctx.fillStyle = '#33271E';
      ctx.font = '900 56px Inter, sans-serif';
      ctx.fillText(deltaWStr, 305, 470);

      // Stat Card 2
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath();
      ctx.roundRect(570, 330, 410, 200, [20]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#756A5D';
      ctx.font = '800 24px Inter, sans-serif';
      ctx.fillText('WAIST CHANGE', 775, 390);

      ctx.fillStyle = '#33271E';
      ctx.font = '900 56px Inter, sans-serif';
      ctx.fillText(deltaWaistStr, 775, 470);

      // 4. Photos (Before vs Current)
      const pad1 = '01';
      const padCur = String(currentWeek).padStart(2, '0');

      const { data: p1 } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(`${currentUser.id}/week-${pad1}/front.jpg`, 3600);

      const { data: pCur } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(`${currentUser.id}/week-${padCur}/front.jpg`, 3600);

      const loadImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = url;
        });

      // Photo 1 (Week 1)
      ctx.fillStyle = '#EDE2C7';
      ctx.beginPath();
      ctx.roundRect(100, 580, 410, 680, [20]);
      ctx.fill();

      if (p1?.signedUrl) {
        try {
          const img1 = await loadImage(p1.signedUrl);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(100, 580, 410, 680, [20]);
          ctx.clip();
          ctx.drawImage(img1, 100, 580, 410, 680);
          ctx.restore();
        } catch {}
      }

      ctx.fillStyle = '#33271E';
      ctx.font = '900 28px Inter, sans-serif';
      ctx.fillText('WEEK 1', 305, 1310);

      // Photo 2 (Current Week)
      ctx.fillStyle = '#EDE2C7';
      ctx.beginPath();
      ctx.roundRect(570, 580, 410, 680, [20]);
      ctx.fill();

      if (pCur?.signedUrl) {
        try {
          const imgCur = await loadImage(pCur.signedUrl);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(570, 580, 410, 680, [20]);
          ctx.clip();
          ctx.drawImage(imgCur, 570, 580, 410, 680);
          ctx.restore();
        } catch {}
      }

      ctx.fillStyle = '#33271E';
      ctx.font = '900 28px Inter, sans-serif';
      ctx.fillText(`WEEK ${currentWeek}`, 775, 1310);

      // 5. Bottom Motivational Tagline
      ctx.fillStyle = '#33271E';
      ctx.fillRect(0, H - 180, W, 180);

      ctx.fillStyle = '#FFFDF7';
      ctx.font = '900 36px Inter, sans-serif';
      ctx.fillText('TRACK THE WORK. SEE THE PROGRESS.', W / 2, H - 95);

      ctx.fillStyle = '#DDD2BD';
      ctx.font = '700 24px Inter, sans-serif';
      ctx.fillText('DIAMONDMASS COACHING SYSTEM', W / 2, H - 50);

      setRendering(false);
    }

    draw();
  }, [isOpen, profile, user, currentWeek, checkins]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `diamondmass-week${currentWeek}-progress.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="card max-w-sm w-full max-h-[90vh] flex flex-col p-4 bg-[var(--paper-light)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-[var(--brown-dark)]">
            {t('shareProgressCard')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--brown-dark)]"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[11px] text-[var(--muted)] mb-3">
          {t('shareProgressCardSub')}
        </p>

        <div className="flex-1 overflow-auto flex justify-center bg-[var(--cream-soft)] rounded-xl p-2 mb-3">
          {rendering ? (
            <div className="flex h-64 items-center justify-center text-xs font-bold text-[var(--muted)]">
              Generating Card...
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="max-h-[50vh] w-auto rounded-lg shadow-md"
            />
          )}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="btn primary w-full flex items-center justify-center gap-2"
        >
          <Download size={16} />
          <span>{t('downloadProgressCard')}</span>
        </button>
      </div>
    </div>
  );
}
