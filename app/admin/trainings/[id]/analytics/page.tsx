'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getQuiz, Training, Enrollment, Quiz } from '@/lib/db';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import styles from './page.module.css';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const CATEGORIES = ['Teori', 'Teknis Dasar', 'Teknis Penerapan', 'Analisis', 'Strategi Kompleks'];

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [preTest, setPreTest] = useState<Quiz | null>(null);
  const [postTest, setPostTest] = useState<Quiz | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { router.push('/login'); return; }

    const fetchData = async () => {
      try {
        const t = await getTrainingById(resolvedParams.id);
        if (!t) { router.push('/admin'); return; }
        setTraining(t);

        const [enrs, pre, post] = await Promise.all([
          getTrainingEnrollments(resolvedParams.id),
          getQuiz(resolvedParams.id, 'pre-test'),
          getQuiz(resolvedParams.id, 'post-test')
        ]);
        
        setEnrollments(enrs);
        setPreTest(pre);
        setPostTest(post);
        setDataLoading(false);
      } catch (err) {
        console.error(err);
        alert('Gagal memuat data analisis');
      }
    };
    fetchData();
  }, [resolvedParams.id, user, isAdmin, loading, router]);

  if (loading || dataLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Menghitung data analisis...</p>
      </div>
    );
  }

  // --- Calculations ---
  const preTestEnrollments = enrollments.filter(e => e.preTestScore !== undefined && e.preTestScore !== null);
  const postTestEnrollments = enrollments.filter(e => e.postTestScore !== undefined && e.postTestScore !== null);
  
  const participantCount = preTestEnrollments.length;

  let avgPreTestScore = 0;
  let avgPostTestScore = 0;

  if (preTestEnrollments.length > 0) {
    avgPreTestScore = preTestEnrollments.reduce((sum, e) => sum + (e.preTestScore || 0), 0) / preTestEnrollments.length;
  }
  if (postTestEnrollments.length > 0) {
    avgPostTestScore = postTestEnrollments.reduce((sum, e) => sum + (e.postTestScore || 0), 0) / postTestEnrollments.length;
  }

  const delta = avgPostTestScore - avgPreTestScore;

  // Level Logic
  let level = 1;
  let levelLabel = 'Pemahaman Dasar';
  let levelDesc = 'Rata-rata kompetensi peserta masih di tahap dasar.';
  
  if (avgPostTestScore >= 80) {
    level = 3;
    levelLabel = 'Strategi Kompleks';
    levelDesc = 'Peserta telah menguasai materi secara komprehensif hingga ke level strategis.';
  } else if (avgPostTestScore >= 60) {
    level = 2;
    levelLabel = 'Penerapan & Analisis';
    levelDesc = 'Peserta mampu menerapkan dan menganalisis materi dengan baik.';
  }

  // Radar Chart Data Logic
  const calculateCategoryAverages = (quiz: Quiz | null, testType: 'preTestAnswers' | 'postTestAnswers') => {
    const validEnrs = testType === 'preTestAnswers' ? preTestEnrollments : postTestEnrollments;
    if (!quiz || validEnrs.length === 0) return CATEGORIES.map(() => 0);

    return CATEGORIES.map(cat => {
      // Find all questions in this category
      const catQuestions = quiz.questions.map((q, index) => ({ q, index }))
        .filter(item => (item.q.category || 'Teori') === cat);

      if (catQuestions.length === 0) return 0; // No questions for this category

      const maxPoints = catQuestions.reduce((sum, item) => sum + item.q.points, 0);
      if (maxPoints === 0) return 0;

      // Calculate total earned points across all users
      let totalEarned = 0;
      validEnrs.forEach(enr => {
        const answers = enr[testType] || [];
        catQuestions.forEach(item => {
          if (answers[item.index] === item.q.correctAnswer) {
            totalEarned += item.q.points;
          }
        });
      });

      // Average percentage
      const avgScore = (totalEarned / (maxPoints * validEnrs.length)) * 100;
      return avgScore;
    });
  };

  const preTestCatScores = calculateCategoryAverages(preTest, 'preTestAnswers');
  const postTestCatScores = calculateCategoryAverages(postTest, 'postTestAnswers');

  const radarData = {
    labels: CATEGORIES,
    datasets: [
      {
        label: 'Pre-Test',
        data: preTestCatScores,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
      },
      {
        label: 'Post-Test',
        data: postTestCatScores,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
      },
    ],
  };

  const radarOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(0,0,0,0.1)' },
        grid: { color: 'rgba(0,0,0,0.1)' },
        pointLabels: {
          font: { size: 12, family: "'Inter', sans-serif" },
          color: '#4b5563'
        },
        ticks: {
          min: 0,
          max: 100,
          stepSize: 20,
          display: false,
        }
      }
    },
    plugins: {
      legend: { position: 'bottom' as const }
    },
    maintainAspectRatio: false,
  };

  // Question Analysis Logic
  const getQuestionStats = (quiz: Quiz | null, testType: 'preTestAnswers' | 'postTestAnswers') => {
    const validEnrs = testType === 'preTestAnswers' ? preTestEnrollments : postTestEnrollments;
    if (!quiz) return [];
    return quiz.questions.map((q, i) => {
      let correctCount = 0;
      validEnrs.forEach(enr => {
        const answers = enr[testType] || [];
        if (answers[i] === q.correctAnswer) correctCount++;
      });
      const rate = validEnrs.length > 0 ? (correctCount / validEnrs.length) * 100 : 0;
      return { question: q.question, category: q.category || 'Teori', rate };
    });
  };

  const preTestStats = getQuestionStats(preTest, 'preTestAnswers');
  const postTestStats = getQuestionStats(postTest, 'postTestAnswers');

  // Evaluation Ratings Logic
  const calculateEvaluationStats = () => {
    let categorySums: Record<string, number> = {};
    let categoryCounts: Record<string, number> = {};
    let totalScore = 0;
    let totalCount = 0;

    enrollments.forEach(enr => {
      if (enr.evaluations) {
        Object.values(enr.evaluations).forEach(evalData => {
          if (evalData.ratings) {
            Object.entries(evalData.ratings).forEach(([cat, score]) => {
              categorySums[cat] = (categorySums[cat] || 0) + score;
              categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
              totalScore += score;
              totalCount += 1;
            });
          }
        });
      }
    });

    const categoryAverages = Object.keys(categorySums).map(cat => ({
      category: cat,
      avg: categorySums[cat] / categoryCounts[cat]
    }));

    const totalAverage = totalCount > 0 ? totalScore / totalCount : 0;

    return { categoryAverages, totalAverage, totalCount };
  };

  const evalStats = calculateEvaluationStats();

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumb}>
          <Link href="/admin">Panel Admin</Link>
          <span>/</span>
          <Link href={`/admin/trainings/${training?.id}`}>Kelola Pelatihan</Link>
          <span>/</span>
          <span>Analisis</span>
        </div>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Analisis Pelatihan 📊</h1>
            <p className={styles.subtitle}>{training?.title}</p>
          </div>
          <button className="btn btn-secondary print-hidden" onClick={() => window.print()}>
            🖨️ Cetak PDF
          </button>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Peserta Evaluasi</span>
            <span className={styles.statValue}>{participantCount}</span>
            <span className={styles.statDesc}>Yang telah menyelesaikan Pre-Test</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Rata-Rata Pre-Test</span>
            <span className={styles.statValue}>{avgPreTestScore.toFixed(1)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Rata-Rata Post-Test</span>
            <span className={styles.statValue}>{avgPostTestScore.toFixed(1)}</span>
            <span className={styles.statDesc} style={{ color: delta > 0 ? 'var(--status-ongoing)' : 'inherit' }}>
              {delta > 0 ? `▲ +${delta.toFixed(1)}` : `▼ ${delta.toFixed(1)}`}
            </span>
          </div>
          <div className={`${styles.statCard} ${styles.levelCard}`}>
            <span className={styles.statLabel}>Level Kompetensi</span>
            <span className={styles.statValue}>Level {level}</span>
            <span className={styles.statDesc}>{levelLabel}</span>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* Radar Chart */}
          <div className={styles.chartCard}>
            <h3>Pemetaan Kategori Kompetensi</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center' }}>
              Perbandingan skor rata-rata berdasarkan kategori soal (Maksimal 100).
            </p>
            <div className={styles.chartWrapper}>
              <Radar data={radarData} options={radarOptions} />
            </div>
          </div>

          {/* Additional Info / Level Summary */}
          <div className={styles.chartCard} style={{ alignItems: 'flex-start' }}>
            <h3>Kesimpulan Peningkatan</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              Berdasarkan hasil perbandingan agregat antara Pre-Test dan Post-Test, pemahaman peserta pelatihan ini berada di:
            </p>
            
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', width: '100%', marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '1.2rem' }}>
                Level {level} - {levelLabel}
              </h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                {levelDesc}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Peningkatan Tertinggi</span>
                <span style={{ fontWeight: 600 }}>
                  {(() => {
                    let maxDiff = -999;
                    let bestCat = '-';
                    CATEGORIES.forEach((cat, i) => {
                      const diff = postTestCatScores[i] - preTestCatScores[i];
                      if (diff > maxDiff) { maxDiff = diff; bestCat = cat; }
                    });
                    return maxDiff > 0 ? `${bestCat} (+${maxDiff.toFixed(1)})` : '-';
                  })()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Evaluasi Dibutuhkan</span>
                <span style={{ fontWeight: 600, color: 'var(--status-upcoming)' }}>
                  {(() => {
                    let minDiff = 999;
                    let worstCat = '-';
                    CATEGORIES.forEach((cat, i) => {
                      const diff = postTestCatScores[i] - preTestCatScores[i];
                      if (diff < minDiff) { minDiff = diff; worstCat = cat; }
                    });
                    return worstCat !== '-' ? `${worstCat}` : '-';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Evaluation Summary */}
        <div className={styles.tableCard} style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>⭐ Hasil Evaluasi Pelatihan</h3>
              <p style={{ color: 'var(--text-muted)' }}>Berdasarkan feedback dari peserta</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {evalStats.totalAverage.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 5.0</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Rata-rata Keseluruhan ({evalStats.totalCount} penilaian)
              </div>
            </div>
          </div>
          
          {evalStats.categoryAverages.length > 0 && (
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {evalStats.categoryAverages.map((cat, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{cat.category}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{cat.avg.toFixed(1)}</span>
                    <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} style={{ opacity: star <= Math.round(cat.avg) ? 1 : 0.3 }}>★</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question Analysis Table Pre-Test */}
        <div className={styles.tableCard}>
          <h3>Analisis Per Soal (Pre-Test)</h3>
          {preTestStats.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Belum ada data evaluasi soal.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>Pertanyaan</th>
                    <th style={{ width: '20%' }}>Kategori</th>
                    <th style={{ width: '30%' }}>Tingkat Kebenaran</th>
                  </tr>
                </thead>
                <tbody>
                  {preTestStats.map((stat, i) => (
                    <tr key={i}>
                      <td>{stat.question.length > 80 ? stat.question.substring(0, 80) + '...' : stat.question}</td>
                      <td>
                        <span className="badge badge-ongoing" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          {stat.category}
                        </span>
                      </td>
                      <td>
                        <div className={styles.correctRate}>
                          <span style={{ width: '40px', fontWeight: 600 }}>{stat.rate.toFixed(0)}%</span>
                          <div className={styles.correctRateBar}>
                            <div 
                              className={styles.correctRateFill} 
                              style={{ 
                                width: `${stat.rate}%`, 
                                background: stat.rate > 70 ? '#10b981' : stat.rate > 40 ? '#f59e0b' : '#ef4444' 
                              }} 
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Question Analysis Table Post-Test */}
        <div className={styles.tableCard} style={{ marginTop: '24px' }}>
          <h3>Analisis Per Soal (Post-Test)</h3>
          {postTestStats.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Belum ada data evaluasi soal.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>Pertanyaan</th>
                    <th style={{ width: '20%' }}>Kategori</th>
                    <th style={{ width: '30%' }}>Tingkat Kebenaran</th>
                  </tr>
                </thead>
                <tbody>
                  {postTestStats.map((stat, i) => (
                    <tr key={i}>
                      <td>{stat.question.length > 80 ? stat.question.substring(0, 80) + '...' : stat.question}</td>
                      <td>
                        <span className="badge badge-ongoing" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          {stat.category}
                        </span>
                      </td>
                      <td>
                        <div className={styles.correctRate}>
                          <span style={{ width: '40px', fontWeight: 600 }}>{stat.rate.toFixed(0)}%</span>
                          <div className={styles.correctRateBar}>
                            <div 
                              className={styles.correctRateFill} 
                              style={{ 
                                width: `${stat.rate}%`, 
                                background: stat.rate > 70 ? '#10b981' : stat.rate > 40 ? '#f59e0b' : '#ef4444' 
                              }} 
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
