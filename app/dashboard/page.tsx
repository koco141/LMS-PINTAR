'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getUserEnrollments, getTrainingById, getModules, Enrollment, Training } from '@/lib/db';
import styles from './page.module.css';
import { BarChart2, BookOpen, Home, Circle, Play } from 'lucide-react';

interface EnrollmentWithTraining {
  enrollment: Enrollment;
  training: Training;
  isPassed: boolean;
  finalScore: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<EnrollmentWithTraining[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (isAdmin) { router.push('/admin'); return; }
    loadData();
  }, [user, authLoading, isAdmin]);

  const loadData = async () => {
    if (!user) return;
    const enrollments = await getUserEnrollments(user.uid);
    const withTraining = await Promise.all(
      enrollments.map(async (e) => {
        const training = await getTrainingById(e.trainingId);
        if (!training) return null;
        const modules = await getModules(e.trainingId);
        
        const tModules = modules.filter(m => m.type === 'tugas');
        let sumTask = 0;
        const assignmentScores = e.assignmentScores || {};
        tModules.forEach(m => { sumTask += (Number(assignmentScores[m.id]) || 0); });
        const avgTaskScore = tModules.length > 0 ? sumTask / tModules.length : 0;
        
        const level = training.targetLevel || 5;
        let finalScore = e.postTestScore || 0;
        
        if (tModules.length > 0) {
          if (level >= 3) {
            finalScore = Math.round((finalScore * 0.4) + (avgTaskScore * 0.6));
          } else {
            finalScore = Math.round((finalScore * 0.7) + (avgTaskScore * 0.3));
          }
        }
        
        const isPassed = e.postTestScore !== null ? (level >= 3 ? finalScore >= 75 : finalScore >= 70) : false;

        return { enrollment: e, training, isPassed, finalScore };
      })
    );
    setData(withTraining.filter(Boolean) as EnrollmentWithTraining[]);
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Memuat dashboard...</p>
      </div>
    );
  }

  const totalCompleted = data.filter(
    (d) => d.enrollment.postTestScore !== null
  ).length;

  const totalPassed = data.filter(
    (d) => d.isPassed
  ).length;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1>Dashboard Saya</h1>
            <p>Pantau progress dan nilai pelatihan Anda</p>
          </div>
          <div className={styles.userInfo}>
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className={styles.avatar} />
            )}
            <div>
              <p className={styles.userName}>{user?.displayName}</p>
              <p className={styles.userEmail}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '32px' }}>
          <div className="stat-card">
            <span className="stat-label">Total Pelatihan</span>
            <span className="stat-value">{data.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Sudah Selesai</span>
            <span className="stat-value" style={{ color: 'var(--status-ongoing)' }}>
              {totalCompleted}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Sedang Berjalan</span>
            <span className="stat-value" style={{ color: 'var(--primary-light)' }}>
              {data.length - totalCompleted}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Lulus Pelatihan</span>
            <span className="stat-value" style={{ color: 'var(--status-ongoing)' }}>
              {totalPassed}
            </span>
          </div>
        </div>

        {/* Enrollments List */}
        <h2 className={styles.sectionTitle}>Pelatihan Saya</h2>
        {data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpen size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} /></div>
            <h3>Belum ikut pelatihan</h3>
            <p>Masukkan token pelatihan di beranda untuk mulai belajar.</p>
            <a href="/" className="btn btn-primary" style={{ marginTop: '12px' }}>
              <Home size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
              Ke Beranda
            </a>
          </div>
        ) : (
          <div className={styles.enrollmentList}>
            {data.map(({ enrollment, training, isPassed, finalScore }) => {
              const totalMods = enrollment.completedModules.length;
              const isFinished = enrollment.postTestScore !== null;
              return (
                <div key={enrollment.id} className={styles.enrollmentCard}>
                  <div className={styles.enrollmentHeader}>
                    <div>
                      <h4 className={styles.enrollmentTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {training.title}
                        {isFinished && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: isPassed ? '#dcfce7' : '#fee2e2',
                            color: isPassed ? '#16a34a' : '#dc2626',
                            border: `1px solid ${isPassed ? '#bbf7d0' : '#fecaca'}`
                          }}>
                            {isPassed ? 'LULUS' : 'BELUM LULUS'}
                          </span>
                        )}
                      </h4>
                      <span className={`badge badge-${training.status}`} style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Circle size={7} fill="currentColor" />
                        {training.status === 'ongoing' ? 'Berlangsung' : training.status === 'upcoming' ? 'Akan Datang' : 'Selesai'}
                      </span>
                    </div>
                    <a href={`/training/${training.token}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      {isFinished
                        ? <><BarChart2 size={13} />Lihat</>
                        : <><Play size={13} />Lanjutkan</>
                      }
                    </a>
                  </div>

                  <div className={styles.enrollmentStats}>
                    <div className={styles.enrollStatItem}>
                      <span className={styles.enrollStatLabel}>Pre-Test</span>
                      <span className={styles.enrollStatVal} style={{ color: 'var(--status-upcoming)' }}>
                        {enrollment.preTestScore !== null ? `${enrollment.preTestScore} poin` : '—'}
                      </span>
                    </div>
                    <div className={styles.enrollStatItem}>
                      <span className={styles.enrollStatLabel}>Post-Test</span>
                      <span className={styles.enrollStatVal} style={{ color: 'var(--status-ongoing)' }}>
                        {enrollment.postTestScore !== null ? `${enrollment.postTestScore} poin` : '—'}
                      </span>
                    </div>
                    {enrollment.preTestScore !== null && enrollment.postTestScore !== null && (
                      <div className={styles.enrollStatItem}>
                        <span className={styles.enrollStatLabel}>Nilai Akhir</span>
                        <span className={styles.enrollStatVal} style={{ color: isPassed ? '#16a34a' : '#dc2626' }}>
                          {finalScore} poin
                        </span>
                      </div>
                    )}
                    <div className={styles.enrollStatItem}>
                      <span className={styles.enrollStatLabel}>Modul Selesai</span>
                      <span className={styles.enrollStatVal}>{totalMods}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
