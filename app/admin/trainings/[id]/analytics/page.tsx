'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Users, ClipboardList, ArrowLeft } from 'lucide-react';
import { getTrainingById, getTrainingEnrollments, getQuiz, getUserById, getModules, Training, Enrollment, Quiz, AppUser, Module } from '@/lib/db';
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
  const { user, isAdmin, isInstructor, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [preTest, setPreTest] = useState<Quiz | null>(null);
  const [postTest, setPostTest] = useState<Quiz | null>(null);
  const [usersDict, setUsersDict] = useState<Record<string, AppUser>>({});
  const [modules, setModules] = useState<Module[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || (!isAdmin && !isInstructor)) { router.push('/login'); return; }

    const fetchData = async () => {
      try {
        const t = await getTrainingById(resolvedParams.id);
        if (!t) { router.push('/admin'); return; }
        setTraining(t);

        const [enrs, pre, post, mods] = await Promise.all([
          getTrainingEnrollments(resolvedParams.id),
          getQuiz(resolvedParams.id, 'pre-test'),
          getQuiz(resolvedParams.id, 'post-test'),
          getModules(resolvedParams.id)
        ]);
        
        setEnrollments(enrs);
        setPreTest(pre);
        setPostTest(post);
        setModules(mods);

        const userPromises = enrs.map(e => getUserById(e.userId));
        const usersRes = await Promise.all(userPromises);
        const uDict: Record<string, AppUser> = {};
        usersRes.forEach(u => {
          if (u) uDict[u.id] = u;
        });
        setUsersDict(uDict);

        setDataLoading(false);
      } catch (err) {
        console.error(err);
        alert('Gagal memuat data analisis');
      }
    };
    fetchData();
  }, [resolvedParams.id, user, isAdmin, isInstructor, loading, router]);

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

  const tModules = modules.filter(m => m.type === 'tugas');
  let avgTaskScore = 0;
  let avgFinalScore = avgPostTestScore;
  let passedCount = 0;

  if (enrollments.length > 0) {
    let sumTotalFinal = 0;
    let sumTotalTask = 0;
    
    enrollments.forEach(e => {
      let eSumTask = 0;
      const assignmentScores = (e as any).assignmentScores || {};
      tModules.forEach(m => { eSumTask += (Number(assignmentScores[m.id]) || 0); });
      const eAvgTask = tModules.length > 0 ? eSumTask / tModules.length : 0;
      sumTotalTask += eAvgTask;
      
      let eFinal = e.postTestScore || 0;
      const tLvl = training?.targetLevel || 5;
      if (tModules.length > 0) {
        if (tLvl >= 3) {
          eFinal = (eFinal * 0.4) + (eAvgTask * 0.6);
        } else {
          eFinal = (eFinal * 0.7) + (eAvgTask * 0.3);
        }
      }
      sumTotalFinal += eFinal;
      
      let individualLevel = 2;
      if (eFinal >= 80) individualLevel = 5;
      else if (eFinal >= 75) individualLevel = 4;
      else if (eFinal >= 70) individualLevel = 3;
      if (individualLevel >= tLvl) passedCount++;
    });
    
    avgTaskScore = sumTotalTask / enrollments.length;
    avgFinalScore = sumTotalFinal / enrollments.length;
  }

  const delta = avgPostTestScore - avgPreTestScore;

  let maleCount = 0;
  let femaleCount = 0;
  enrollments.forEach(e => {
    const u = usersDict[e.userId];
    if (u?.gender === 'Perempuan') femaleCount++;
    else if (u?.gender === 'Laki-laki') maleCount++;
  });

  // Level Logic
  const targetLevel = training?.targetLevel || 5;
  
  let computedLevel = 2;
  if (avgFinalScore >= 80) computedLevel = 5;
  else if (avgFinalScore >= 75) computedLevel = 4;
  else if (avgFinalScore >= 70) computedLevel = 3;
  
  if (computedLevel > targetLevel) {
    computedLevel = targetLevel;
  }
  
  let level = computedLevel;
  let levelLabel = '';
  let levelDesc = '';

  switch (level) {
    case 5:
      levelLabel = 'Master/Pakar';
      levelDesc = 'Berada di puncak penguasaan keahlian dan memiliki kapasitas untuk membimbing atau memimpin orang lain.';
      break;
    case 4:
      levelLabel = 'Ahli/Superior';
      levelDesc = 'Berkemampuan tingkat lanjut, mencapai performa superior, dan sering menjadi rujukan bagi rekan kerja.';
      break;
    case 3:
      levelLabel = 'Kompeten/Mahir';
      levelDesc = 'Mampu mengevaluasi situasi, merancang perbaikan, serta menyelesaikan masalah yang lebih kompleks.';
      break;
    case 2:
      levelLabel = 'Mampu/Dasar';
      levelDesc = 'Mampu menerapkan pengetahuan dasar dan prinsip-prinsip untuk menyelesaikan pekerjaan rutin tanpa harus diawasi.';
      break;
    case 1:
    default:
      levelLabel = 'Pemula/Paham';
      levelDesc = 'Memiliki pengetahuan dasar tentang teori suatu bidang, namun belum berpengalaman dalam praktik.';
      break;
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
          <Link href="/admin">{isAdmin ? 'Panel Admin' : 'Panel Pengajar'}</Link>
          <span>›</span>
          <span>{training?.title}</span>
          <span>›</span>
          <span>Analisis</span>
        </div>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              Analisis Pelatihan
            </h1>
            <p className={styles.subtitle}>{training?.title}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} className="print-hidden">
            <Link href={`/admin/trainings/${resolvedParams.id}/participants`} className="btn btn-secondary">
              <Users size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Lihat Peserta
            </Link>
            <Link href={`/admin/trainings/${resolvedParams.id}/assignments`} className="btn btn-secondary">
              <ClipboardList size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Penilaian Tugas
            </Link>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Cetak PDF
            </button>
            <Link href="/admin" className="btn btn-secondary">
              <ArrowLeft size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Kembali
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Peserta Evaluasi</span>
            <span className={styles.statValue}>{participantCount}</span>
            <span className={styles.statDesc}>Yang telah menyelesaikan Pre-Test</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Rata-Rata Post-Test</span>
            <span className={styles.statValue}>{avgPostTestScore.toFixed(1)}</span>
            <span className={styles.statDesc} style={{ color: delta > 0 ? 'var(--status-ongoing)' : 'inherit' }}>
              {delta > 0 ? `▲ +${delta.toFixed(1)}` : `▼ ${delta.toFixed(1)}`}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Rata-Rata Tugas</span>
            <span className={styles.statValue}>{avgTaskScore.toFixed(1)}</span>
          </div>
          <div className={styles.statCard} style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <span className={styles.statLabel}>Rata-Rata Nilai Akhir</span>
            <span className={styles.statValue}>{avgFinalScore.toFixed(1)}</span>
            <span className={styles.statDesc}>Bobot {targetLevel >= 3 ? '40% Post-Test, 60% Tugas' : '70% Post-Test, 30% Tugas'}</span>
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
            <h3>Pemetaan Penguasaan Kognitif</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center' }}>
              Perbandingan skor rata-rata berdasarkan kategori soal (Maksimal 100).
            </p>
            <div className={styles.chartWrapper}>
              <Radar data={radarData} options={radarOptions} />
            </div>
          </div>

          {/* Additional Info / Level Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className={styles.chartCard} style={{ alignItems: 'flex-start', padding: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>Demografi Peserta</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{enrollments.length}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Peserta Terdaftar</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border)', margin: '0 16px' }}></div>
                <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6', lineHeight: '1.2' }}>{maleCount}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Laki-laki</div>
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ec4899', lineHeight: '1.2' }}>{femaleCount}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Perempuan</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.chartCard} style={{ alignItems: 'flex-start', padding: '24px' }}>
              <h3 style={{ marginBottom: '12px' }}>Kesimpulan Peningkatan</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px', fontSize: '0.9rem' }}>
                Berdasarkan evaluasi pembelajaran yang menggunakan metode <strong>{training?.method === 'luring' ? 'Luring (Offline)' : 'Daring (Online)'}</strong>
                {training?.method === 'luring' && training?.province ? ` pada lokasi ${training?.province}${training?.city ? `, ${training?.city}` : ''}` : ''}
                {' '}dari akumulasi nilai akhir dengan tingkat kelulusan <strong>{passedCount}/{enrollments.length}</strong> peserta, sehingga tingkat kompetensi peserta saat ini berada di:
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '20px', fontStyle: 'italic' }}>
                *Sumber: Dreyfus Model of Skill Acquisition (Dreyfus & Dreyfus, 1980) & Taksonomi Bloom Revisi (Anderson & Krathwohl, 2001).
              </p>
              
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', width: '100%', marginBottom: '20px' }}>
                <h4 style={{ color: level >= targetLevel ? 'var(--primary)' : '#ef4444', marginBottom: '6px', fontSize: '1.1rem' }}>
                  Level {level} - {levelLabel}
                </h4>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  {levelDesc}
                </p>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: level >= targetLevel ? 'rgba(79, 70, 229, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: level >= targetLevel ? 'var(--primary)' : '#ef4444'
                }}>
                  {level >= targetLevel ? `Telah memenuhi target pelatihan (Target: Level ${targetLevel})` : `Belum memenuhi target pelatihan (Target: Level ${targetLevel})`}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Peningkatan Tertinggi</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
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
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Evaluasi Dibutuhkan</span>
                  <span style={{ fontWeight: 600, color: 'var(--status-upcoming)', fontSize: '0.9rem' }}>
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
        </div>

        {/* Evaluation Summary */}
        <div className={styles.tableCard} style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Hasil Evaluasi Pelatihan</h3>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Analisis Per Soal (Pre-Test)</h3>
            <span style={{ background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Rata-rata: {avgPreTestScore.toFixed(1)}
            </span>
          </div>
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
