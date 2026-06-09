'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getUserEnrollments, getTrainingById, Enrollment, Training } from '@/lib/db';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import styles from './page.module.css';
import { BarChart2, BookOpen, Home, Circle, Play } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  RadialLinearScale, PointElement, LineElement, Filler
);

interface EnrollmentWithTraining {
  enrollment: Enrollment;
  training: Training;
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
        return training ? { enrollment: e, training } : null;
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

  const avgImprovement = (() => {
    const valid = data.filter(
      (d) => d.enrollment.preTestScore !== null && d.enrollment.postTestScore !== null
    );
    if (!valid.length) return null;
    const sum = valid.reduce(
      (acc, d) => acc + (d.enrollment.postTestScore! - d.enrollment.preTestScore!),
      0
    );
    return Math.round(sum / valid.length);
  })();

  const chartData = {
    labels: data.map((d) => d.training.title.substring(0, 20) + (d.training.title.length > 20 ? '…' : '')),
    datasets: [
      {
        label: 'Pre-Test',
        data: data.map((d) => d.enrollment.preTestScore ?? 0),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Post-Test',
        data: data.map((d) => d.enrollment.postTestScore ?? 0),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#a0a0c0', font: { family: 'Plus Jakarta Sans', size: 12 } },
      },
      title: { display: false },
    },
    scales: {
      x: {
        ticks: { color: '#5a5a7a', font: { family: 'Plus Jakarta Sans', size: 11 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks: { color: '#5a5a7a', font: { family: 'Plus Jakarta Sans', size: 11 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        min: 0,
        max: 100,
      },
    },
  };

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
            <span className="stat-label">Rata-rata Peningkatan</span>
            <span className="stat-value" style={{ color: avgImprovement !== null && avgImprovement >= 0 ? 'var(--status-ongoing)' : '#ef4444' }}>
              {avgImprovement !== null ? (avgImprovement >= 0 ? '+' : '') + avgImprovement : '—'}
            </span>
          </div>
        </div>

        {/* Chart */}
        {data.length > 0 && (
          <div className={styles.chartCard}>
            <h3>
              <BarChart2 size={17} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary-light)' }} />
              Perbandingan Pre-Test vs Post-Test
            </h3>
            <div className={styles.chartWrapper}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

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
            {data.map(({ enrollment, training }) => {
              const totalMods = enrollment.completedModules.length;
              const isFinished = enrollment.postTestScore !== null;
              return (
                <div key={enrollment.id} className={styles.enrollmentCard}>
                  <div className={styles.enrollmentHeader}>
                    <div>
                      <h4 className={styles.enrollmentTitle}>{training.title}</h4>
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
                        <span className={styles.enrollStatLabel}>Peningkatan</span>
                        <span className={styles.enrollStatVal} style={{ color: 'var(--primary-light)' }}>
                          {enrollment.postTestScore - enrollment.preTestScore > 0 ? '+' : ''}
                          {enrollment.postTestScore - enrollment.preTestScore} poin
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
