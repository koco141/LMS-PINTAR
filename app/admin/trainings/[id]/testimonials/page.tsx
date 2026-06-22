'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getUserById, Training, Enrollment, AppUser, getModules, Module } from '@/lib/db';
import styles from '../analytics/page.module.css';
import { MessageSquare, FileText, Printer } from 'lucide-react';

interface TestimonialData {
  id: string; // enrollmentId_moduleId
  user: AppUser | null;
  moduleTitle: string;
  ratings: Record<string, number>;
  testimonial: string;
  averageRating: number;
}

const avatarColors = [
  { bg: '#fee2e2', text: '#ef4444' }, // Red
  { bg: '#ffedd5', text: '#f97316' }, // Orange
  { bg: '#fef3c7', text: '#f59e0b' }, // Amber
  { bg: '#dcfce7', text: '#10b981' }, // Emerald
  { bg: '#e0f2fe', text: '#0ea5e9' }, // Sky
  { bg: '#dbeafe', text: '#3b82f6' }, // Blue
  { bg: '#e0e7ff', text: '#6366f1' }, // Indigo
  { bg: '#fae8ff', text: '#d946ef' }, // Fuchsia
  { bg: '#fce7f3', text: '#ec4899' }, // Pink
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
};

export default function TestimonialsPage({ params, onReady }: { params: Promise<{ id: string }>, onReady?: () => void }) {
  const resolvedParams = use(params);
  const { user, isAdmin, isInstructor, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [testimonials, setTestimonials] = useState<TestimonialData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || (!isAdmin && !isInstructor)) { router.push('/login'); return; }

    const fetchData = async () => {
      try {
        const t = await getTrainingById(resolvedParams.id);
        if (!t) { router.push('/admin'); return; }
        if (isInstructor && !isAdmin && t.instructorId !== user?.uid) {
          router.push('/admin');
          return;
        }
        setTraining(t);

        const [enrs, mods] = await Promise.all([
          getTrainingEnrollments(resolvedParams.id),
          getModules(resolvedParams.id)
        ]);

        const modMap = mods.reduce((acc, m) => ({ ...acc, [m.id]: m.title }), {} as Record<string, string>);

        const testimoList: TestimonialData[] = [];
        for (const enr of enrs) {
          if (enr.evaluations) {
            let u: AppUser | null = null;
            Object.entries(enr.evaluations).forEach(([moduleId, evalData]) => {
              if (evalData.testimonial) {
                // Hitung rata-rata rating
                let total = 0;
                let count = 0;
                if (evalData.ratings) {
                  Object.values(evalData.ratings).forEach(r => {
                    total += r;
                    count++;
                  });
                }
                const avgRating = count > 0 ? total / count : 0;

                testimoList.push({
                  id: `${enr.id}_${moduleId}`,
                  user: null, // we will fetch this after
                  moduleTitle: modMap[moduleId] || 'Modul Evaluasi',
                  ratings: evalData.ratings || {},
                  testimonial: evalData.testimonial,
                  averageRating: avgRating
                });
              }
            });
            // Fetch user info if they left a testimonial
            if (Object.keys(enr.evaluations).length > 0) {
              u = await getUserById(enr.userId);
              // Update user object in the list
              testimoList.forEach(item => {
                if (item.id.startsWith(enr.id)) {
                  item.user = u;
                }
              });
            }
          }
        }

        setTestimonials(testimoList);
        setDataLoading(false);
        if (onReady) onReady();
      } catch (err) {
        console.error(err);
        alert('Gagal memuat testimoni');
        if (onReady) onReady(); // Prevent hanging
      }
    };
    fetchData();
  }, [resolvedParams.id, user, isAdmin, isInstructor, loading, router, onReady]);

  if (loading || dataLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Memuat testimoni...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={`${styles.breadcrumb} print-hidden`}>
          <Link href="/admin">{isAdmin ? 'Panel Admin' : 'Panel Pengajar'}</Link>
          <span>/</span>
          <Link href={`/admin/trainings/${training?.id}`}>Kelola Pelatihan</Link>
          <span>/</span>
          <span>Testimoni</span>
        </div>

        <div className="print-only" style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Testimoni Peserta — {training?.title}</h1>
        </div>

        <div className={`${styles.header} print-hidden`}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={20} style={{ color: 'var(--primary-light)' }} />
              Testimoni Peserta
            </h1>
            <p className={styles.subtitle}>{training?.title}</p>
          </div>
          <button className="btn btn-secondary print-hidden" onClick={() => window.print()}>
            <Printer size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Cetak PDF
          </button>
        </div>

        {testimonials.length === 0 ? (
          <div className={styles.chartCard} style={{ textAlign: 'center', padding: '64px' }}>
            <FileText size={48} strokeWidth={1.2} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3>Belum ada testimoni</h3>
            <p style={{ color: 'var(--text-muted)' }}>Belum ada peserta yang mengisi modul evaluasi.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {testimonials.map(item => (
              <div key={item.id} className={styles.chartCard} style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {(() => {
                      const displayName = item.user?.fullName || item.user?.name || 'Anonim';
                      const initial = displayName.substring(0, 1).toUpperCase();
                      const colors = getAvatarColor(displayName);
                      return (
                        <>
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text, fontWeight: 'bold', fontSize: '1.2rem' }}>
                            {initial}
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{displayName}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.user?.email}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '1.25rem', color: '#f59e0b', fontWeight: 'bold' }}>
                      {item.averageRating.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 5.0</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.moduleTitle}</span>
                  </div>
                </div>
                
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', width: '100%', borderLeft: '4px solid var(--primary)' }}>
                  <p style={{ fontStyle: 'italic', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                    "{item.testimonial}"
                  </p>
                </div>

                {Object.keys(item.ratings).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                    {Object.entries(item.ratings).map(([cat, score]) => (
                      <div key={cat} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{cat}:</span>
                        <span style={{ fontWeight: 600, color: '#f59e0b' }}>{score} ★</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
