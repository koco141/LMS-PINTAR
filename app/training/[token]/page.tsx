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
  submitEvaluation,
  submitQuizResult,
  submitAssignment,
  Training,
  Module,
  Quiz,
  Enrollment,
  getGroups,
  Group,
} from '@/lib/db';
import QuizPlayer from '@/components/QuizPlayer';
import ModuleViewer from '@/components/ModuleViewer';
import AssignmentViewer from '@/components/AssignmentViewer';
import EvaluationViewer from '@/components/EvaluationViewer';
import Leaderboard from '@/components/Leaderboard';
import GroupInfoWidget from '@/components/GroupInfoWidget';
import GroupChatBubble from '@/components/GroupChatBubble';
import styles from './page.module.css';
import {
  Search, Lock, LogIn, GraduationCap, Package, FileText, ClipboardList,
  CheckCircle2, Trophy, BookOpen, Star, Folder, CalendarClock,
  LayoutDashboard, CheckCheck, ChevronRight, HelpCircle, Timer,
  Sparkles, Play, Users
} from 'lucide-react';

type Step = 'loading' | 'enroll' | 'choose-group' | 'login' | 'study';
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
  const [activeTab, setActiveTab] = useState<'learn' | 'leaderboard' | 'group'>('learn');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

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
    if (!enroll) { 
      if (t.learningModel === 'GROUP') {
        const fetchedGroups = await getGroups(t.id);
        setGroups(fetchedGroups);
        if (t.groupSelectionType === 'MANUAL' && fetchedGroups.length > 0) {
          setStep('choose-group');
          return;
        }
      }
      setStep('enroll'); 
      return; 
    }
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

  const handleEnroll = async (groupId?: string) => {
    if (!user || !training) return;
    await enrollUser(user.uid, training.id, typeof groupId === 'string' ? groupId : undefined);
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

  const handleQuizSubmit = async (type: 'pre-test' | 'post-test', score: number, answers: number[], selfAssessment?: number[]) => {
    if (!user || !training) return;
    await submitQuizResult(user.uid, training.id, type, score, answers, selfAssessment);
    const updated = await getEnrollment(user.uid, training.id);
    setEnrollment(updated);
    setQuizStarted(false);
  };

  const handleAssignmentSubmit = async (moduleId: string, link: string) => {
    if (!user || !training) return;
    await submitAssignment(user.uid, training.id, moduleId, link);
    const updated = await getEnrollment(user.uid, training.id);
    setEnrollment(updated);
  };

  if (notFound) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <Search size={64} strokeWidth={1.2} style={{ color: 'var(--text-muted)' }} />
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
          <span className={styles.enrollEmoji}>
            <Lock size={40} strokeWidth={1.5} style={{ color: 'var(--primary-light)' }} />
          </span>
          <h2>Login untuk Mengakses Pelatihan</h2>
          <p className={styles.trainingTitle}>{training?.title}</p>
          <p>Silakan login dengan akun Google Anda untuk mengakses pelatihan ini.</p>
          <button className={styles.googleBtn} onClick={handleGoogleSignIn} disabled={signInLoading}>
            {signInLoading
              ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              : <><LogIn size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Masuk dengan Google</>
            }
          </button>
          <a href="/" className="btn btn-secondary btn-sm">← Kembali</a>
        </div>
      </div>
    );
  }

  if (step === 'choose-group') {
    return (
      <div className={styles.enrollPage}>
        <div className={styles.enrollCard}>
          <span className={styles.enrollEmoji}>
            <Users size={44} strokeWidth={1.3} style={{ color: 'var(--primary-light)' }} />
          </span>
          <h2>Pilih Kelompok</h2>
          <p className={styles.trainingTitle}>{training?.title}</p>
          <p>Pelatihan ini menggunakan sistem kelompok. Silakan pilih kelompok Anda untuk dapat berdiskusi dan mengumpulkan tugas kelompok.</p>
          
          <div style={{ margin: '20px 0', textAlign: 'left' }}>
            <label className="form-label">Kelompok Tersedia</label>
            <select 
              className="form-input" 
              value={selectedGroupId} 
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="" disabled>-- Pilih Kelompok --</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-primary btn-lg" 
            onClick={() => handleEnroll(selectedGroupId)}
            disabled={!selectedGroupId}
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Pilih &amp; Mulai Pelatihan
          </button>
          <a href="/" className="btn btn-secondary btn-sm" style={{ marginTop: '16px', display: 'block', textAlign: 'center' }}>← Kembali</a>
        </div>
      </div>
    );
  }

  if (step === 'enroll') {
    return (
      <div className={styles.enrollPage}>
        <div className={styles.enrollCard}>
          <span className={styles.enrollEmoji}>
            <GraduationCap size={44} strokeWidth={1.3} style={{ color: 'var(--primary-light)' }} />
          </span>
          <h2>Daftar Pelatihan</h2>
          <p className={styles.trainingTitle}>{training?.title}</p>
          <p>Klik tombol di bawah untuk mendaftar dan mulai pelatihan ini.</p>
          <div className={styles.enrollMeta}>
            <span><Package size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{modules.length} modul materi</span>
            {preTest && <span><FileText size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Pre-test tersedia</span>}
            {postTest && <span><ClipboardList size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Post-test tersedia</span>}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => handleEnroll()}>
            <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Daftar &amp; Mulai Pelatihan
          </button>
          <a href="/" className="btn btn-secondary btn-sm">← Kembali</a>
        </div>
      </div>
    );
  }

  // Study Phase (Unified Layout)
  const isEnforcementBlocked = (training?.targetLevel || 5) >= 3 && modules.filter(m => m.type === 'tugas').length === 0;
  const isPreTestDone = preTest === null || (enrollment && enrollment.preTestScore !== null);
  const isModulesUnlocked = isPreTestDone && !isEnforcementBlocked;
  const completedModsCount = enrollment ? enrollment.completedModules.length : 0;
  const allModulesCompleted = modules.length > 0 && completedModsCount === modules.length;
  const isPostTestUnlocked = isPreTestDone && (modules.length === 0 || allModulesCompleted) && !isEnforcementBlocked;

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

  // Helper to get sidebar item status icon
  const getStatusIcon = (locked: boolean, done: boolean | null | undefined, active: boolean, fallback: React.ReactNode) => {
    if (locked) return <Lock size={14} />;
    if (done) return <CheckCircle2 size={14} style={{ color: 'var(--status-ongoing)' }} />;
    if (active) return <ChevronRight size={14} />;
    return fallback;
  };

  const postTestMaxAttempts = postTest?.maxAttempts || 1;
  const postTestHistory = enrollment?.postTestHistory || [];
  const postTestCurrentAttempts = Math.max(postTestHistory.length, enrollment?.postTestScore !== null ? 1 : 0);
  const canRetakePostTest = postTestMaxAttempts === 0 || postTestCurrentAttempts < postTestMaxAttempts;

  return (
    <>
      <div className={styles.trainingLayout}>
        {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>{training?.title}</h3>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <button 
              className={`btn ${activeTab === 'learn' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('learn')}
            >
              Belajar
            </button>
            {training?.showLeaderboard && (
              <button 
                className={`btn ${activeTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                onClick={() => setActiveTab('leaderboard')}
              >
                Peringkat
              </button>
            )}
            {training?.learningModel === 'GROUP' && enrollment?.groupId && (
              <button 
                className={`btn ${activeTab === 'group' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ flex: 1, padding: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => setActiveTab('group')}
              >
                <Users size={14} />
                Kelompok
              </button>
            )}
          </div>

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
                <FileText size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Pre-Test
                {isUpcoming && <Lock size={11} style={{ marginLeft: '5px', verticalAlign: 'middle', opacity: 0.6 }} />}
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
                  {isUpcoming
                    ? <Lock size={13} />
                    : enrollment?.preTestScore !== null
                      ? <CheckCircle2 size={13} style={{ color: 'var(--status-ongoing)' }} />
                      : <FileText size={13} />
                  }
                </span>
                <span className={styles.moduleName}>Pre-Test</span>
              </button>
              <div style={{ height: '8px' }} />
            </>
          )}

          <div className={styles.moduleListHeader}>
            <BookOpen size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
            Materi
            {(isUpcoming || !isModulesUnlocked) && <Lock size={11} style={{ marginLeft: '5px', verticalAlign: 'middle', opacity: 0.6 }} />}
          </div>
          {modules.map((mod, idx) => {
            const isDone = enrollment?.completedModules.includes(mod.id);
            const isCurrent = activeStep === 'module' && activeModule?.id === mod.id;
            const isUnlocked = isModulesUnlocked && !isUpcoming;
            const ModIcon = mod.type === 'tugas' ? FileText : mod.type === 'evaluasi' ? Star : BookOpen;
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
                  {!isUnlocked
                    ? <Lock size={13} />
                    : isDone
                      ? <CheckCircle2 size={13} style={{ color: 'var(--status-ongoing)' }} />
                      : isCurrent
                        ? <ChevronRight size={13} />
                        : <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{idx + 1}</span>
                  }
                </span>
                <span className={styles.moduleName}>
                  <ModIcon size={12} style={{ marginRight: '4px', verticalAlign: 'middle', opacity: 0.7 }} />
                  {mod.title}
                </span>
              </button>
            );
          })}

          {training?.assignmentLink && (
            <>
              <div style={{ height: '8px' }} />
              <div className={styles.moduleListHeader}>
                <Folder size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Pengumpulan Tugas
                {(isUpcoming || !isModulesUnlocked) && <Lock size={11} style={{ marginLeft: '5px', verticalAlign: 'middle', opacity: 0.6 }} />}
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
                  {(!isUpcoming && isModulesUnlocked) ? <Folder size={13} /> : <Lock size={13} />}
                </span>
                <span className={styles.moduleName}>Submit Tugas / Materi</span>
              </a>
            </>
          )}

          {postTest && (
            <>
              <div style={{ height: '8px' }} />
              <div className={styles.moduleListHeader}>
                <ClipboardList size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Post-Test
                {(isUpcoming || !isPostTestUnlocked) && <Lock size={11} style={{ marginLeft: '5px', verticalAlign: 'middle', opacity: 0.6 }} />}
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
                  {isUpcoming || !isPostTestUnlocked
                    ? <Lock size={13} />
                    : enrollment?.postTestScore !== null
                      ? <CheckCircle2 size={13} style={{ color: 'var(--status-ongoing)' }} />
                      : <ClipboardList size={13} />
                  }
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
              <span className={styles.moduleNum}><Trophy size={14} style={{ color: '#f59e0b' }} /></span>
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
        {isEnforcementBlocked ? (
          <div className={styles.completedPage}>
            <div className={styles.completedCard}>
              <div className={styles.completedBadge} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
                <Lock size={28} strokeWidth={1.5} />
              </div>
              <h2 style={{ color: '#b91c1c' }}>Pelatihan Terkunci</h2>
              <p className={styles.trainingTitle}>{training?.title}</p>
              <p style={{ margin: '16px 0', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Pelatihan belum dapat diakses. Instruktur sedang melengkapi instrumen asesmen standar kompetensi untuk pelatihan ini.
              </p>
              <div style={{ marginTop: '24px' }}>
                <a href="/dashboard" className="btn btn-secondary">
                  <LayoutDashboard size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                  Kembali ke Dashboard
                </a>
              </div>
            </div>
          </div>
        ) : isUpcoming ? (
          <div className={styles.completedPage}>
            <div className={styles.completedCard}>
              <div className={styles.completedBadge} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-upcoming)' }}>
                <CalendarClock size={28} strokeWidth={1.5} />
              </div>
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
                <a href="/dashboard" className="btn btn-secondary">
                  <LayoutDashboard size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                  Kembali ke Dashboard
                </a>
              </div>
            </div>
          </div>
        ) : training?.showLeaderboard && activeTab === 'leaderboard' ? (
          <Leaderboard trainingId={training.id} />
        ) : training?.learningModel === 'GROUP' && enrollment?.groupId && activeTab === 'group' ? (
          <GroupInfoWidget 
            trainingId={training.id} 
            groupId={enrollment.groupId} 
            groupName={groups.find(g => g.id === enrollment.groupId)?.name || 'Kelompok'}
            currentUser={user ? { id: user.uid, name: user.displayName } : null}
          />
        ) : activeStep === 'pre-test' && preTest ? (
              enrollment?.preTestScore !== null ? (
                /* Pre Test Completed Result */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>
                      <FileText size={28} strokeWidth={1.5} />
                    </div>
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
                      <Play size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                      Mulai Belajar Materi
                    </button>
                  </div>
                </div>
              ) : !quizStarted ? (
                /* Pre Test Confirmation Prompt */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>
                      <FileText size={28} strokeWidth={1.5} />
                    </div>
                    <h2>Mulai Pre-Test</h2>
                    <p className={styles.trainingTitle}>{preTest.title || 'Pre-Test'}</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Kuis ini digunakan untuk mengukur pemahaman awal Anda sebelum mempelajari materi.
                    </p>
                    <div className={styles.enrollMeta} style={{ margin: '12px 0' }}>
                      <span><HelpCircle size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{preTest.questions.length} Pertanyaan</span>
                      <span><Timer size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{preTest.duration ? `${preTest.duration} Menit` : 'Tanpa Batas Waktu'}</span>
                    </div>
                    <h3 style={{ margin: '10px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      Apakah Anda sudah siap untuk memulai kuis?
                    </h3>
                    <button className="btn btn-primary btn-lg" onClick={() => setQuizStarted(true)}>
                      <Play size={16} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                      Ya, Mulai Kuis
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Pre Test */
                <QuizPlayer
                  quiz={preTest}
                  onSubmit={(score, answers, selfAssessment) => handleQuizSubmit('pre-test', score, answers, selfAssessment)}
                  previousScore={null}
                />
              )
            ) : activeStep === 'post-test' && postTest ? (
              enrollment?.postTestScore !== null && !quizStarted ? (
                /* Post Test Completed Result */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>
                      <Trophy size={28} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
                    </div>
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
                        <span className={styles.scoreLabel}>Post-Test (Tertinggi)</span>
                        <span className={styles.scoreValue} style={{ color: 'var(--status-ongoing)' }}>
                          {enrollment?.postTestScore}
                        </span>
                      </div>
                    </div>

                    {postTestHistory.length > 0 && (
                      <div style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'var(--bg-input)', padding: '16px', borderRadius: '12px' }}>
                        <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Riwayat Percobaan:</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {postTestHistory.map((hist, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Percobaan {idx + 1}</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{hist.score} poin</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
                      {canRetakePostTest && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => setQuizStarted(true)}
                        >
                          <Play size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                          Coba Lagi ({postTestMaxAttempts === 0 ? 'Tanpa Batas' : `Sisa ${postTestMaxAttempts - postTestCurrentAttempts} Kali`})
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => setActiveStep('completed')}
                      >
                        <Trophy size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                        Lihat Hasil Pelatihan Lengkap
                      </button>
                    </div>
                  </div>
                </div>
              ) : !quizStarted ? (
                /* Post Test Confirmation Prompt */
                <div className={styles.completedPage}>
                  <div className={styles.completedCard}>
                    <div className={styles.completedBadge}>
                      <ClipboardList size={28} strokeWidth={1.5} />
                    </div>
                    <h2>Mulai Post-Test</h2>
                    <p className={styles.trainingTitle}>{postTest.title || 'Post-Test'}</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Kuis ini digunakan sebagai penilaian akhir kompetensi Anda setelah mempelajari seluruh materi.
                    </p>
                    <div className={styles.enrollMeta} style={{ margin: '12px 0' }}>
                      <span><HelpCircle size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{postTest.questions.length} Pertanyaan</span>
                      <span><Timer size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />{postTest.duration ? `${postTest.duration} Menit` : 'Tanpa Batas Waktu'}</span>
                    </div>
                    <h3 style={{ margin: '10px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      Apakah Anda sudah siap untuk memulai kuis?
                    </h3>
                    <button className="btn btn-primary btn-lg" onClick={() => setQuizStarted(true)}>
                      <Play size={16} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                      Ya, Mulai Kuis
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Post Test */
                <QuizPlayer
                  quiz={postTest}
                  onSubmit={(score, answers, selfAssessment) => handleQuizSubmit('post-test', score, answers, selfAssessment)}
                  previousScore={enrollment?.preTestScore ?? null}
                />
              )
            ) : activeStep === 'module' && activeModule ? (
              activeModule.type === 'tugas' ? (
                <AssignmentViewer
                  module={activeModule}
                  isCompleted={enrollment?.completedModules.includes(activeModule.id) || false}
                  onComplete={() => handleModuleComplete(activeModule.id)}
                  onSubmitLink={async (link, text) => {
                    if (!enrollment || !user || !training) return;
                    await submitAssignment(user.uid, training.id, activeModule.id, link, text);
                    await markModuleComplete(user.uid, training.id, activeModule.id);
                    const updated = await getEnrollment(user.uid, training.id);
                    setEnrollment(updated);
                  }}
                  existingLink={enrollment?.assignments?.[activeModule.id]}
                  existingText={enrollment?.assignmentTexts?.[activeModule.id]}
                  isGroupAssignment={activeModule.isGroupAssignment && training?.learningModel === 'GROUP'}
                  isGroupLeader={enrollment?.isGroupLeader}
                />
              ) : activeModule.type === 'evaluasi' ? (
                <EvaluationViewer
                  module={activeModule}
                  isCompleted={enrollment?.completedModules.includes(activeModule.id) || false}
                  onComplete={() => handleModuleComplete(activeModule.id)}
                  onSubmitEvaluation={async (ratings, testimonial) => {
                    if (!enrollment || !user || !training) return;
                    await submitEvaluation(user.uid, training.id, activeModule.id, ratings, testimonial);
                    await markModuleComplete(user.uid, training.id, activeModule.id);
                    const updated = await getEnrollment(user.uid, training.id);
                    setEnrollment(updated);
                  }}
                  existingEvaluation={enrollment?.evaluations?.[activeModule.id]}
                />
              ) : (
                <ModuleViewer
                  module={activeModule}
                  isCompleted={enrollment?.completedModules.includes(activeModule.id) || false}
                  onComplete={() => handleModuleComplete(activeModule.id)}
                />
              )
            ) : activeStep === 'completed' ? (
          <div className={styles.completedPage}>
            <div className={styles.completedCard}>
              <div className={styles.completedBadge}>
                <Sparkles size={28} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
              </div>
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
                <a href="/dashboard" className="btn btn-primary">
                  <LayoutDashboard size={15} style={{ marginRight: '7px', verticalAlign: 'middle' }} />
                  Lihat Dashboard
                </a>
                <a href="/" className="btn btn-secondary">← Beranda</a>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <BookOpen size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3>Pilih modul untuk mulai belajar</h3>
          </div>
        )}
      </main>
    </div>

    {/* Group Chat Bubble */}
    {training?.learningModel === 'GROUP' && training?.enableGroupChat && enrollment?.groupId && (
      <GroupChatBubble 
        groupId={enrollment.groupId} 
        currentUser={user ? { id: user.uid, name: user.displayName } : null} 
      />
    )}
  </>
);
}
