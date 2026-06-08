'use client';

import { useEffect, useState } from 'react';
import { getTrainingEnrollments, getUserById, AppUser } from '@/lib/db';
import styles from './Leaderboard.module.css';

interface LeaderboardEntry {
  rank: number;
  name: string;
  email: string;
  photoURL: string | null;
  postTestScore: number | null;
  preTestScore: number | null;
  progress: number;
}

export default function Leaderboard({ trainingId }: { trainingId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const enrollments = await getTrainingEnrollments(trainingId);
      const withUsers = await Promise.all(
        enrollments.map(async (e) => {
          const user = await getUserById(e.userId);
          return {
            postTestScore: e.postTestScore,
            preTestScore: e.preTestScore,
            completedModules: e.completedModules,
            name: user?.fullName || user?.name || 'Anonim',
            email: user?.email || '',
            photoURL: user?.photoURL || null,
          };
        })
      );

      const sorted = withUsers
        .sort((a, b) => (b.postTestScore || 0) - (a.postTestScore || 0))
        .map((e, idx) => ({
          rank: idx + 1,
          name: e.name,
          email: e.email,
          photoURL: e.photoURL,
          postTestScore: e.postTestScore,
          preTestScore: e.preTestScore,
          progress: Math.round((e.completedModules.length / Math.max(1, e.completedModules.length)) * 100),
        }));

      setEntries(sorted);
      setLoading(false);
    }
    load();
  }, [trainingId]);

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '300px' }}>
        <div className="spinner" />
      </div>
    );
  }

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🏆 Leaderboard</h2>
        <p>Peringkat peserta berdasarkan nilai post-test</p>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <h3>Belum ada data</h3>
          <p>Leaderboard akan muncul setelah peserta menyelesaikan post-test.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {entries.map((entry) => (
            <div
              key={entry.rank}
              className={`${styles.row} ${entry.rank <= 3 ? styles.topThree : ''}`}
            >
              <span className={styles.rank}>
                {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
              </span>
              <div className={styles.avatar}>
                {entry.photoURL ? (
                  <img src={entry.photoURL} alt={entry.name} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {entry.name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.info}>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.email}>{entry.email}</span>
              </div>
              <div className={styles.scores}>
                {entry.preTestScore !== null && (
                  <div className={styles.score}>
                    <span className={styles.scoreLabel}>Pre</span>
                    <span className={styles.scoreVal} style={{ color: 'var(--status-upcoming)' }}>
                      {entry.preTestScore}
                    </span>
                  </div>
                )}
                {entry.postTestScore !== null && (
                  <div className={styles.score}>
                    <span className={styles.scoreLabel}>Post</span>
                    <span className={styles.scoreVal} style={{ color: 'var(--status-ongoing)' }}>
                      {entry.postTestScore}
                    </span>
                  </div>
                )}
                {entry.postTestScore === null && (
                  <span className={styles.pending}>Belum selesai</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
