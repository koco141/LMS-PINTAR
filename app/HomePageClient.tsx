'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTrainingByToken, Training, getUserEnrollments } from '@/lib/db';
import { useAuth } from '@/lib/auth-context';
import TrainingCard from '@/components/TrainingCard';
import styles from './page.module.css';
import { Rocket, Key, CheckCircle2, AlertTriangle, BookOpen, Circle, GraduationCap, InboxIcon, ChevronLeft, ChevronRight } from 'lucide-react';

type FilterType = 'all' | 'ongoing' | 'upcoming' | 'completed';

interface Props {
  initialTrainings: Training[];
}

export default function HomePageClient({ initialTrainings }: Props) {
  const { user } = useAuth();
  const [trainings] = useState<Training[]>(initialTrainings);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [tokenSuccess, setTokenSuccess] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  
  const router = useRouter();

  useEffect(() => {
    if (user) {
      getUserEnrollments(user.uid).then((enrollments) => {
        setEnrolledIds(enrollments.map(e => e.trainingId));
      });
    } else {
      setEnrolledIds([]);
    }
  }, [user]);

  const handleTokenSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setTokenLoading(true);
    setTokenError('');
    setTokenSuccess(false);
    try {
      const training = await getTrainingByToken(token.trim());
      if (!training) {
        setTokenError('Token tidak ditemukan. Periksa kembali kode pelatihan Anda.');
        setTokenLoading(false);
        return;
      }
      setTokenSuccess(true);
      setTimeout(() => {
        router.push(`/training/${token.trim().toUpperCase()}`);
      }, 600);
    } catch {
      setTokenError('Terjadi kesalahan. Coba lagi.');
      setTokenLoading(false);
    }
  };

  const filteredTrainings = trainings.filter((t) =>
    filter === 'all' ? true : t.status === filter
  );

  const totalPages = Math.ceil(filteredTrainings.length / ITEMS_PER_PAGE);
  const currentTrainings = filteredTrainings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const counts = {
    all: trainings.length,
    ongoing: trainings.filter((t) => t.status === 'ongoing').length,
    upcoming: trainings.filter((t) => t.status === 'upcoming').length,
    completed: trainings.filter((t) => t.status === 'completed').length,
  };

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <div className={styles.heroOrb1} />
          <div className={styles.heroOrb2} />
          <div className={styles.heroOrb3} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <Rocket size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Platform Pembelajaran Profesional
          </div>
          <h1 className={styles.heroTitle}>
            Tingkatkan Kompetensi
            <br />
            <span className={styles.heroGradient}>Bersama PINTAR</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Platform Pintar untuk Training — Akses pelatihan berkualitas, lacak progress,
            dan buktikan kemampuanmu dengan evaluasi yang terstruktur.
          </p>

          {/* Token Search — HIGHLIGHT */}
          <form className={styles.tokenForm} onSubmit={handleTokenSearch}>
            <div className={`${styles.tokenInputWrapper} ${tokenError ? styles.error : ''} ${tokenSuccess ? styles.success : ''}`}>
              <span className={styles.tokenIcon}><Key size={16} /></span>
              <input
                id="token-search"
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value.toUpperCase());
                  setTokenError('');
                  setTokenSuccess(false);
                }}
                placeholder="Masukkan TOKEN pelatihan Anda (contoh: ABC123)"
                className={styles.tokenInput}
                maxLength={6}
                disabled={tokenLoading}
                autoComplete="off"
                spellCheck={false}
              />
              {token && (
                <button
                  type="button"
                  onClick={() => { setToken(''); setTokenError(''); }}
                  className={styles.clearBtn}
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className={styles.tokenBtn}
                disabled={tokenLoading || !token.trim()}
              >
                {tokenLoading ? (
                  <span className={styles.miniSpinner} />
                ) : tokenSuccess ? (
                  <CheckCircle2 size={16} />
                ) : (
                  'Cari'
                )}
              </button>
            </div>
            {tokenError && (
              <p className={styles.tokenError}>
                <AlertTriangle size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                {tokenError}
              </p>
            )}
            {tokenSuccess && (
              <p className={styles.tokenSuccess}>
                <CheckCircle2 size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Pelatihan ditemukan! Mengalihkan...
              </p>
            )}
            <p className={styles.tokenHint}>
              Dapatkan token pelatihan dari instruktur atau koordinator Anda
            </p>
          </form>
        </div>

        {/* Stats */}
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{counts.ongoing}</span>
            <span className={styles.heroStatLabel}>Sedang Berjalan</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{counts.upcoming}</span>
            <span className={styles.heroStatLabel}>Akan Datang</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{counts.completed}</span>
            <span className={styles.heroStatLabel}>Selesai</span>
          </div>
        </div>
      </section>

      {/* Trainings List */}
      <section className={styles.trainingsSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2>Daftar Pelatihan</h2>
            <p>Temukan pelatihan yang sesuai dengan kebutuhan Anda</p>
          </div>

          {/* Filter Tabs */}
          <div className={styles.filterTabs}>
            {(
              [
                { key: 'all', label: 'Semua', icon: <BookOpen size={14} /> },
                { key: 'ongoing', label: 'Berlangsung', icon: <Circle size={9} fill="currentColor" style={{ color: 'var(--status-ongoing)' }} /> },
                { key: 'upcoming', label: 'Akan Datang', icon: <Circle size={9} fill="currentColor" style={{ color: 'var(--status-upcoming)' }} /> },
                { key: 'completed', label: 'Selesai', icon: <Circle size={9} fill="currentColor" style={{ color: 'var(--text-muted)' }} /> },
              ] as { key: FilterType; label: string; icon: React.ReactNode }[]
            ).map((f) => (
              <button
                key={f.key}
                className={`${styles.filterTab} ${filter === f.key ? styles.active : ''}`}
                onClick={() => setFilter(f.key)}
              >
                <span>{f.icon}</span>
                {f.label}
                <span className={styles.filterCount}>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {/* Trainings Grid */}
          {filteredTrainings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><InboxIcon size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} /></div>
              <h3>Belum ada pelatihan</h3>
              <p>
                {filter === 'all'
                  ? 'Belum ada pelatihan yang tersedia saat ini.'
                  : `Tidak ada pelatihan dengan status "${filter}" saat ini.`}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.trainingsGrid}>
                {currentTrainings.map((training, idx) => (
                  <TrainingCard 
                    key={training.id} 
                    training={training} 
                    index={idx} 
                    isEnrolled={training.id ? enrolledIds.includes(training.id) : false} 
                  />
                ))}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ padding: '8px', borderRadius: '50%' }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{ padding: '8px', borderRadius: '50%' }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerContent}>
            <div className={styles.footerLogo}>
              <GraduationCap size={22} strokeWidth={2} />
              <span>
                PIN<span style={{ color: 'var(--primary-light)' }}>TAR</span>
              </span>
            </div>
            <p className={styles.footerText}>
              Platform Pintar untuk Training — Belajar lebih cerdas, lebih terstruktur.
            </p>
          </div>
          <div className={styles.footerBottom}>
            <p>© {new Date().getFullYear()} PINTAR. Semua hak dilindungi.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
