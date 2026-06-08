'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getTrainingByToken,
  getModules,
  getQuiz,
  getEnrollment,
  enrollUser,
  markModuleComplete,
  submitQuizResult,
  Training,
  Module,
  Quiz,
  Enrollment,
} from '@/lib/db';
import QuizPlayer from '@/components/QuizPlayer';
import ModuleViewer from '@/components/ModuleViewer';
import Leaderboard from '@/components/Leaderboard';
import styles from './page.module.css';

type Step = 'loading' | 'enroll' | 'login' | 'study';
type ActiveStep = 'pre-test' | 'module' | 'post-test' | 'completed';

export default function TrainingPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [preTest, setPreTest] = useState<Quiz | null>(null);
  const [postTest, setPostTest] = useState<Quiz | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [activeStep, setActiveStep] = useState<ActiveStep>('pre-test');
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'learn' | 'leaderboard'>('learn');

  useEffect(() => {
    if (authLoading) return;
    loadTraining();
  }, [token, authLoading, user]);

  const loadTraining = async () => {
    setStep('loading');
    const t = await getTrainingByToken(token);
    if (!t) { setNotFound(true); setStep('loading'); return; }
    setTraining(t);

    const [mods, pre, post] = await Promise.all([
      getModules(t.id),
      getQuiz(t.id, 'pre-test'),
      getQuiz(t.id, 'post-test'),
    ]);
    setModules(mods);
    setPreTest(pre);
    setPostTest(post);

    if (!user) { setStep('login'); return; }

    let enroll = await getEnrollment(user.uid, t.id);
    if (!enroll) { setStep('enroll'); return; }
    setEnrollment(enroll);
    determineStep(enroll, pre, post, mods);
  };

  const determineStep = (enroll: Enrollment, pre: Quiz | null, post: Quiz | null, mods: Module[]) => {
    setStep('study');
    const preDone = pre === null || enroll.preTestScore !== null;
    const allModsDone = mods.every((m) => enroll.completedModules.includes(m.id));
    const postDone = post === null || enroll.postTestScore !== null;

    if (!preDone) {
      setActiveStep('pre-test');
      setQuizStarted(false);
      return;
    }
    if (mods.length > 0 && !allModsDone) {
      setActiveStep('module');
      const next = mods.find((m) => !enroll.completedModules.includes(m.id));
      setActiveModule(next || mods[0]);
      return;
    }
    if (post && !postDone) {
      setActiveStep('post-test');
      setQuizStarted(false);
      return;
    }
    setActiveStep('completed');
  };

  const handleEnroll = async () => {
    if (!user || !training) return;
    await enrollUser(user.uid, training.id);
    const enroll = await getEnrollment(user.uid, training.id);
    setEnrollment(enroll);
    determineStep(enroll!, preTest, postTest, modules);
  };

  const handleGoogleSignIn = async () => {
    setSignInLoading(true);
    try { await signInWithGoogle(); } catch { }
    setSignInLoading(false);
  };

  const handleModuleComplete = async (moduleId: string) => {
    if (!user || !training || !enrollment) return;
    await markModuleComplete(user.uid, training.id, moduleId);
    const updated = await getEnrollment(user.uid, training.id);
    setEnrollment(updated);
    const currentIdx = modules.findIndex((m) => m.id === moduleId);
    if (currentIdx < modules.length - 1) {
      setActiveModule(modules[currentIdx + 1]);
    } else {
      determineStep(updated!, preTest, postTest, modules);
    }
  };

  const handleQuizSubmit = async (type: 'pre-test' | 'post-test', score: number, answers: number[]) => {
    if (!user || !training) return;
    await submitQuizResult(user.uid, training.id, type, score, answers);
    const updated = await getEnrollment(user.uid, training.id);
    setEnrollment(updated);
    setQuizStarted(false);
    determineStep(updated!, preTest, postTest, modules);
  };

  if (notFound) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '4rem' }}>🔍</span>
          <h2>Token tidak ditemukan</h2>
          <p>Periksa kembali kode token yang Anda masukkan.</p>
          <a href="/" className="btn btn-primary">← Kembali ke Beranda</a>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Memuat pelatihan...</p>
      </div>
    );
  }

  if (step === 'login') {
    return (
      <div className={styles.enrollPage}>
        <div className={styles.enrollCard}>
          <span className={styles.enrollEmoji}>🔒</span>
          <h2>Login untuk Mengakses Pelatihan</h2>
          <p className={styles.trainingTitle}>{training?.title}</p>
          <p>Silakan login dengan akun Google Anda untuk mengakses pelatihan ini.</p>
          <button className={styles.googleBtn} onClick={handleGoogleSignIn} disabled={signInLoading}>
            {signInLoading ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : '🔑 Masuk dengan Google'}
          </button>
          <a href="/" className="btn btn-secondary btn-sm">← Kembali</a>
        </div>
      </div>
    );
  }

  if (step === 'enroll') {
    return (
      <div className={styles.enrollPage}>
        <div className={styles.enrollCard}>
          <span className={styles.enrollEmoji}>🎓</span>
          <h2>Daftar Pelatihan</h2>
          <p className={styles.trainingTitle}>{training?.title}</p>
          <p>Klik tombol di bawah untuk mendaftar dan mulai pelatihan ini.</p>
          <div className={styles.enrollMeta}>
            <span>📦 {modules.length} modul materi</span>
            {preTest && <span>📝 Pre-test tersedia</span>}
            {postTest && <span>📋 Post-test tersedia</span>}
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleEnroll}>
            ✅ Daftar & Mulai Pelatihan
          </button>
          <a href="/" className="btn btn-secondary btn-sm">← Kembali</a>
        </div>
      </div>
    );
  }

  // Study Phase (Unified Layout)
  const isPreTestDone = preTest === null || (enrollment && enrollment.preTestScore !== null);
  const isModulesUnlocked = isPreTestDone;
  const completedModsCount = enrollment ? enrollment.completedModules.length : 0;
  const allModulesCompleted = modules.length > 0 && completedModsCount === modules.length;
  const isPostTestUnlocked = isPreTestDone && (modules.length === 0 || allModulesCompleted);

  const progress = enrollment
    ? Math.round((completedModsCount / (modules.length || 1)) * 100)
    : 0;

  // Upcoming Status & Time Validation
  const isUpcoming = training?.status === 'upcoming' || (() => {
    if (!training?.startDate) return false;
    try {
      const date = typeof training.startDate.toDate === 'function'
        ? training.startDate.toDate()
        : new Date((training.startDate as any).seconds * 1000);
      return date > new Date();
    } catch {
      return false;
    }
  })();

  const getStartDateString = () => {
    if (!training?.startDate) return '';
    try {
      const date = typeof training.startDate.toDate === 'function'
        ? training.startDate.toDate()
        : new Date((training.startDate as any).seconds * 1000);
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.trainingLayout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>{training?.title}</h3>
          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>Progress</span>
              <span className={styles.progressPct}>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.progressSub}>
              {completedModsCount}/{modules.length} modul
            </span>
          </div>
        </div>

        <nav className={styles.moduleList}>
          {preTest && (
            <>
              <div className={styles.moduleListHeader}>
                📝 Pre-Test {isUpcoming && '🔒'}
              </div>
              <button
                className={`${styles.moduleItem} ${activeStep === 'pre-test' && !isUpcoming ? styles.current : ''} ${enrollment?.preTestScore !== null ? styles.done : ''}`}
                disabled={isUpcoming}
                style={{ opacity: isUpcoming ? 0.5 : 1, cursor: isUpcoming ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (isUpcoming) return;
                  setActiveStep('pre-test');
                  setQuizStarted(false);
                  setActiveTab('learn');
                }}
              >
                <span className={styles.moduleNum}>
                  {isUpcoming ? '🔒' : enrollment?.preTestScore !== null ? '✅' : '📝'}
                </span>
                <span className={styles.moduleName}>Pre-Test</span>
              </button>
              <div style={{ height: '8px' }} />
            </>
          )}

          <div className={styles.moduleListHeader}>
            📚 Materi {(isUpcoming || !isModulesUnlocked) && '🔒'}
          </div>
          {modules.map((mod, idx) => {
            const isDone = enrollment?.completedModules.includes(mod.id);
            const isCurrent = activeStep === 'module' && activeModule?.id === mod.id;
            const isUnlocked = isModulesUnlocked && !isUpcoming;
            return (
              <button
                key={mod.id}
                className={`${styles.moduleItem} ${isCurrent && isUnlocked ? styles.current : ''} ${isDone ? styles.done : ''}`}
                disabled={!isUnlocked}
                style={{ opacity: isUnlocked ? 1 : 0.5, cursor: isUnlocked ? 'pointer' : 'not-allowed' }}
                onClick={() => {
                  if (!isUnlocked) return;
                  setActiveStep('module');
                  setActiveModule(mod);
                  setActiveTab('learn');
                }}
              >
                <span className={styles.moduleNum}>
                  {!isUnlocked ? '🔒' : isDone ? '✅' : isCurrent ? '▶' : `${idx + 1}`}
                </span>
                <span className={styles.moduleName}>{mod.title}</span>
              </button>
            );
          })}

          {training?.assignmentLink && (
            <>
              <div style={{ height: '8px' }} />
              <div className={styles.moduleListHeader}>
                📁 Pengumpulan Tugas {(isUpcoming || !isModulesUnlocked) && '🔒'}
              </div>
              <a
                href={(!isUpcoming && isModulesUnlocked) ? training.assignmentLink : '#'}
                target={(!isUpcoming && isModulesUnlocked) ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`${styles.moduleItem} ${(!isUpcoming && isModulesUnlocked) ? '' : styles.locked}`}
                style={{
                  opacity: (!isUpcoming && isModulesUnlocked) ? 1 : 0.5,
                  cursor: (!isUpcoming && isModulesUnlocked) ? 'pointer' : 'not-allowed',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={(e) => {
                  if (isUpcoming || !isModulesUnlocked) {
                    e.preventDefault();
                  }
                }}
              >
                <span className={styles.moduleNum}>
                  {(!isUpcoming && isModulesUnlocked) ? '📁' : '🔒'}
                </span>
                <span className={styles.moduleName}>Submit Tugas / Materi</span>
              </a>
            </>
          )}

          {postTest && (
            <>
              <div style={{ height: '8px' }} />
              <div className={styles.moduleListHeader}>
                📋 Post-Test {(isUpcoming || !isPostTestUnlocked) && '🔒'}
              </div>
              <button
                className={`${styles.moduleItem} ${activeStep === 'post-test' && !isUpcoming ? styles.current : ''} ${enrollment?.postTestScore !== null ? styles.done : ''}`}
                disabled={isUpcoming || !isPostTestUnlocked}
                style={{ opacity: (isUpcoming || !isPostTestUnlocked) ? 0.5 : 1, cursor: (isUpcoming || !isPostTestUnlocked) ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (isUpcoming || !isPostTestUnlocked) return;
                  setActiveStep('post-test');
                  setQuizStarted(false);
                  setActiveTab('learn');
                }}
              >
                <span className={styles.moduleNum}>
                  {isUpcoming || !isPostTestUnlocked ? '🔒' : enrollment?.postTestScore !== null ? '✅' : '📋'}
                </span>
                <span className={styles.moduleName}>Post-Test</span>
              </button>
            </>
          )}

          {/* Selesai Tab */}
          {enrollment?.postTestScore !== null && postTest && !isUpcoming && (
            <button
              className={`${styles.moduleItem} ${activeStep === 'completed' ? styles.current : ''}`}
              style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
              onClick={() => { setActiveStep('completed'); setActiveTab('learn'); }}
            >
              <span className={styles.moduleNum}>🏆</span>
              <span className={styles.moduleName}>Hasil Pelatihan</span>
            </button>
          )}
        </nav>

        <div className={styles.sidebarScores}>
          {enrollment?.preTestScore !== null && (
            <div className={styles.sidebarScore}>
              <span>Pre-Test</span>
              <span style={{ color: 'var(--status-upcoming)', fontWeight: '700' }}>
                {enrollment?.preTestScore}
              </span>
            </div>
          )}
          {enrollment?.postTestScore !== null && (
            <div className={styles.sidebarScore}>
              <span>Post-Test</span>
              <span style={{ color: 'var(--status-ongoing)', fontWeight: '700' }}>
                {enrollment?.postTestScore}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {isUpcoming ? (
          <div className={styles.completedPage}>
            <div className={styles.completedCard}>
              <div className={styles.completedBadge} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-upcoming)' }}>📅</div>
              <h2>Pelatihan Belum Dimulai</h2>
              <p className={styles.trainingTitle}>{training?.title}</p>
              <p style={{ margin: '16px 0', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Materi pelatihan dan kuis belum dapat diakses saat ini karena pelatihan dijadwalkan untuk dimulai pada:
              </p>
              {training?.startDate ? (
                <div style={{
                  padding: '12px 20px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'inline-block',
                  marginBottom: '16px'
                }}>
                  {getStartDateString()}
                </div>
              ) : (
                <div style={{
                  padding: '12px 20px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'inline-block',
                  marginBottom: '16px'
                }}>
                  Menunggu Status Aktif dari Instruktur
                </div>
              )}
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Silakan hubungi instruktur atau koordinator Anda untuk informasi lebih lanjut.
              </p>
              <div style={{ marginTop: '24px' }}>
                <a href="/dashboard" className="btn btn-secondary">📊 Kembali ke Dashboard</a>
              </div>
            </div>
          </div>
        ) : training?.showLeaderboard && activeTab === 'leaderboard' ? (
          <Leaderboard trainingId={training.id} />
        ) : activeStep === 'pre-test' && preTest ? (
              enrollment?.preTestScore !== null ? (
                /* Pre Test Completed Result */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>📝</div>
                    <h2>Pre-Test Selesai!</h2>
                    <p>Anda telah menyelesaikan Pre-Test dengan nilai:</p>
                    <div className={styles.scoreGrid}>
                      <div className={styles.scoreItem}>
                        <span className={styles.scoreLabel}>Nilai</span>
                        <span className={styles.scoreValue} style={{ color: 'var(--status-upcoming)' }}>
                          {enrollment?.preTestScore} poin
                        </span>
                      </div>
                    </div>
                    <p className={styles.footerText} style={{ marginTop: '12px' }}>
                      Silakan lanjut mempelajari materi yang telah terbuka di sidebar kiri.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => determineStep(enrollment!, preTest, postTest, modules)}
                    >
                      ▶ Mulai Belajar Materi
                    </button>
                  </div>
                </div>
              ) : !quizStarted ? (
                /* Pre Test Confirmation Prompt */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>📝</div>
                    <h2>Mulai Pre-Test</h2>
                    <p className={styles.trainingTitle}>{preTest.title || 'Pre-Test'}</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Kuis ini digunakan untuk mengukur pemahaman awal Anda sebelum mempelajari materi.
                    </p>
                    <div className={styles.enrollMeta} style={{ margin: '12px 0' }}>
                      <span>❓ {preTest.questions.length} Pertanyaan</span>
                      <span>⏱️ {preTest.duration ? `${preTest.duration} Menit` : 'Tanpa Batas Waktu'}</span>
                    </div>
                    <h3 style={{ margin: '10px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      Apakah Anda sudah siap untuk memulai kuis?
                    </h3>
                    <button className="btn btn-primary btn-lg" onClick={() => setQuizStarted(true)}>
                      ▶ Ya, Mulai Kuis
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Pre Test */
                <QuizPlayer
                  quiz={preTest}
                  onSubmit={(score, answers) => handleQuizSubmit('pre-test', score, answers)}
                  previousScore={null}
                />
              )
            ) : activeStep === 'post-test' && postTest ? (
              enrollment?.postTestScore !== null ? (
                /* Post Test Completed Result */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>🏆</div>
                    <h2>Post-Test Selesai!</h2>
                    <p>Anda telah menyelesaikan Post-Test pelatihan dengan nilai:</p>
                    <div className={styles.scoreGrid}>
                      <div className={styles.scoreItem}>
                        <span className={styles.scoreLabel}>Pre-Test</span>
                        <span className={styles.scoreValue} style={{ color: 'var(--status-upcoming)' }}>
                          {enrollment?.preTestScore}
                        </span>
                      </div>
                      <div className={styles.scoreItem}>
                        <span className={styles.scoreLabel}>Post-Test</span>
                        <span className={styles.scoreValue} style={{ color: 'var(--status-ongoing)' }}>
                          {enrollment?.postTestScore}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => setActiveStep('completed')}
                    >
                      🏆 Lihat Hasil Pelatihan Lengkap
                    </button>
                  </div>
                </div>
              ) : !quizStarted ? (
                /* Post Test Confirmation Prompt */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>📋</div>
                    <h2>Mulai Post-Test</h2>
                    <p className={styles.trainingTitle}>{postTest.title || 'Post-Test'}</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Kuis ini digunakan sebagai penilaian akhir kompetensi Anda setelah mempelajari seluruh materi.
                    </p>
                    <div className={styles.enrollMeta} style={{ margin: '12px 0' }}>
                      <span>❓ {postTest.questions.length} Pertanyaan</span>
                      <span>⏱️ {postTest.duration ? `${postTest.duration} Menit` : 'Tanpa Batas Waktu'}</span>
                    </div>
                    <h3 style={{ margin: '10px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      Apakah Anda sudah siap untuk memulai kuis?
                    </h3>
                    <button className="btn btn-primary btn-lg" onClick={() => setQuizStarted(true)}>
                      ▶ Ya, Mulai Kuis
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Post Test */
                <QuizPlayer
                  quiz={postTest}
                  onSubmit={(score, answers) => handleQuizSubmit('post-test', score, answers)}
                  previousScore={enrollment?.preTestScore ?? null}
                />
              )
            ) : activeStep === 'module' && activeModule ? (
              <ModuleViewer
                module={activeModule}
                isCompleted={enrollment?.completedModules.includes(activeModule.id) || false}
                onComplete={() => handleModuleComplete(activeModule.id)}
              />
            ) : activeStep === 'completed' ? (
          <div className={styles.completedPage}>
            <div className={styles.completedCard}>
              <div className={styles.completedBadge}>🏆</div>
              <h2>Pelatihan Selesai!</h2>
              <p className={styles.trainingTitle}>{training?.title}</p>
              <div className={styles.scoreGrid}>
                {enrollment?.preTestScore !== null && (
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Nilai Pre-Test</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--status-upcoming)' }}>
                      {enrollment?.preTestScore}
                    </span>
                  </div>
                )}
                {enrollment?.postTestScore !== null && (
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Nilai Post-Test</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--status-ongoing)' }}>
                      {enrollment?.postTestScore}
                    </span>
                  </div>
                )}
                {enrollment?.preTestScore !== null && enrollment?.postTestScore !== null && (
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Peningkatan</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--primary-light)' }}>
                      +{(enrollment!.postTestScore! - enrollment!.preTestScore!).toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.completedActions} style={{ marginTop: '20px' }}>
                <a href="/dashboard" className="btn btn-primary">📊 Lihat Dashboard</a>
                <a href="/" className="btn btn-secondary">← Beranda</a>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <h3>Pilih modul untuk mulai belajar</h3>
          </div>
        )}
      </main>
    </div>
  );
}
