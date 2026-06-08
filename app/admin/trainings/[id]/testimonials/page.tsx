'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getUserById, Training, Enrollment, AppUser, getModules, Module } from '@/lib/db';
import styles from '../analytics/page.module.css';

interface TestimonialData {
  id: string; // enrollmentId_moduleId
  user: AppUser | null;
  moduleTitle: string;
  ratings: Record<string, number>;
  testimonial: string;
  averageRating: number;
}

export default function TestimonialsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [testimonials, setTestimonials] = useState<TestimonialData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { router.push('/login'); return; }

    const fetchData = async () => {
      try {
        const t = await getTrainingById(resolvedParams.id);
        if (!t) { router.push('/admin'); return; }
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
      } catch (err) {
        console.error(err);
        alert('Gagal memuat data testimoni');
      }
    };
    fetchData();
  }, [resolvedParams.id, user, isAdmin, loading, router]);

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
        <div className={styles.breadcrumb}>
          <Link href="/admin">Panel Admin</Link>
          <span>/</span>
          <Link href={`/admin/trainings/${training?.id}`}>Kelola Pelatihan</Link>
          <span>/</span>
          <span>Testimoni</span>
        </div>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Testimoni Peserta 💬</h1>
            <p className={styles.subtitle}>{training?.title}</p>
          </div>
          <button className="btn btn-secondary print-hidden" onClick={() => window.print()}>
            🖨️ Cetak PDF
          </button>
        </div>

        {testimonials.length === 0 ? (
          <div className={styles.chartCard} style={{ textAlign: 'center', padding: '64px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📝</div>
            <h3>Belum ada testimoni</h3>
            <p style={{ color: 'var(--text-muted)' }}>Belum ada peserta yang mengisi modul evaluasi.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {testimonials.map(item => (
              <div key={item.id} className={styles.chartCard} style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      {item.user?.name?.substring(0, 1).toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.user?.name || 'Anonim'}</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.user?.email}</p>
                    </div>
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
