'use client';

import { useState, useEffect } from 'react';
import { Module, Quiz, getQuizById } from '@/lib/db';
import QuizPlayer from './QuizPlayer';
import styles from './ModuleViewer.module.css'; // Reusing ModuleViewer styles for layout

export default function ModuleQuizViewer({
  trainingId,
  module,
  isCompleted,
  onComplete,
  onSubmitQuiz,
  existingScore,
}: {
  trainingId: string;
  module: Module;
  isCompleted: boolean;
  onComplete: () => void;
  onSubmitQuiz: (score: number, answers: number[]) => Promise<void>;
  existingScore?: number;
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!module.quizId) {
      setLoading(false);
      return;
    }
    getQuizById(trainingId, module.quizId).then(q => {
      setQuiz(q);
      setLoading(false);
    });
  }, [trainingId, module.quizId]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Memuat kuis...</p></div>;
  }

  if (!quiz) {
    return (
      <div className={styles.moduleContainer}>
        <div className="empty-state">
          <h3>Kuis Belum Tersedia</h3>
          <p>Kuis untuk modul ini belum dibuat oleh instruktur.</p>
          <button className="btn btn-primary" onClick={onComplete}>Lewati Modul Ini</button>
        </div>
      </div>
    );
  }

  if (isCompleted || existingScore !== undefined) {
    return (
      <div className={styles.moduleContainer}>
        <div className={styles.moduleHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2>❓ {module.title}</h2>
            <span className={styles.badgeCompleted}>Selesai</span>
          </div>
          <p className={styles.moduleDesc}>Anda telah menyelesaikan kuis ini.</p>
        </div>
        
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '24px', textAlign: 'center' }}>
          <h3>Nilai Kuis: <span style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>{existingScore ?? 100}</span></h3>
          <button className="btn btn-primary" onClick={onComplete} style={{ marginTop: '16px' }}>Lanjut ke Materi Berikutnya</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.moduleContainer} style={{ padding: 0 }}>
      {/* We reuse QuizPlayer which already has its own container styling */}
      <QuizPlayer 
        quiz={quiz} 
        onSubmit={async (score, answers) => {
          await onSubmitQuiz(score, answers);
          onComplete();
        }} 
        previousScore={null} 
      />
    </div>
  );
}
