'use client';

import { useState, useEffect, useRef } from 'react';
import { Quiz, QuizQuestion } from '@/lib/db';
import styles from './QuizPlayer.module.css';

interface Props {
  quiz: Quiz;
  onSubmit: (score: number, answers: number[]) => void;
  previousScore: number | null;
}

export default function QuizPlayer({ quiz, onSubmit, previousScore }: Props) {
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Shuffle questions and options on mount or quiz changes
  useEffect(() => {
    if (!quiz || !quiz.questions || quiz.questions.length === 0) return;

    // 1. Shuffle questions using Fisher-Yates
    const qList = quiz.questions.map((q, originalQIdx) => ({ ...q, originalQIdx }));
    for (let i = qList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qList[i], qList[j]] = [qList[j], qList[i]];
    }

    // 2. Shuffle options for each question and preserve their original index
    const prepared = qList.map((q) => {
      const preparedOptions = q.options.map((opt, idx) => ({
        text: opt,
        originalIndex: idx,
      }));
      for (let i = preparedOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [preparedOptions[i], preparedOptions[j]] = [preparedOptions[j], preparedOptions[i]];
      }
      return {
        ...q,
        shuffledOptions: preparedOptions,
      };
    });

    setShuffledQuestions(prepared);
    setAnswers(new Array(prepared.length).fill(null));
    setCurrentQ(0);
    setSubmitted(false);

    // 3. Setup Timer
    if (quiz.duration && quiz.duration > 0) {
      setTimeLeft(quiz.duration * 60);
    } else {
      setTimeLeft(null);
    }
  }, [quiz]);

  // Timer Effect
  useEffect(() => {
    if (timeLeft === null || submitted) return;

    if (timeLeft <= 0) {
      alert('Waktu pengerjaan kuis telah habis! Lembar jawaban Anda dikumpulkan otomatis.');
      submitAutomatically();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const submitAutomatically = () => {
    let totalScore = 0;
    let totalPoints = 0;
    const mappedAnswers = new Array(quiz.questions.length).fill(null);
    shuffledQuestions.forEach((q, idx) => {
      totalPoints += q.points || 10;
      const ans = answersRef.current[idx];
      mappedAnswers[q.originalQIdx] = ans;
      if (ans === q.correctAnswer) {
        totalScore += q.points || 10;
      }
    });
    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    setScore(percentage);
    setSubmitted(true);
    onSubmit(percentage, mappedAnswers);
  };

  const handleAnswer = (qIdx: number, optOriginalIdx: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[qIdx] = optOriginalIdx;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    let totalScore = 0;
    let totalPoints = 0;
    const mappedAnswers = new Array(quiz.questions.length).fill(null);
    shuffledQuestions.forEach((q, idx) => {
      totalPoints += q.points || 10;
      mappedAnswers[q.originalQIdx] = answers[idx];
      if (answers[idx] === q.correctAnswer) {
        totalScore += q.points || 10;
      }
    });
    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    setScore(percentage);
    setSubmitted(true);
    onSubmit(percentage, mappedAnswers);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (shuffledQuestions.length === 0) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Menyiapkan kuis...</p>
      </div>
    );
  }

  const totalQuestions = shuffledQuestions.length;
  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === totalQuestions;
  const isPreTest = quiz.type === 'pre-test';

  return (
    <div className={styles.container} style={{ minHeight: 'auto', padding: '24px 0' }}>
      {!submitted ? (
        <>
          {/* Quiz Header */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.quizType}>
                {isPreTest ? '📝 Pre-Test' : '📋 Post-Test'}
              </div>
              <h1 className={styles.title}>{quiz.title || (isPreTest ? 'Pre-Test' : 'Post-Test')}</h1>
              <p className={styles.subtitle}>
                Jawab semua pertanyaan berikut dengan jujur.{' '}
                {isPreTest && 'Ini membantu mengukur pengetahuan awal Anda.'}
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              {timeLeft !== null && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  background: timeLeft < 30 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(79, 70, 229, 0.05)',
                  border: `1px solid ${timeLeft < 30 ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: timeLeft < 30 ? '#ef4444' : 'var(--text-primary)',
                  fontWeight: '700',
                  fontFamily: 'Sora, monospace',
                  fontSize: '0.9rem',
                }}>
                  ⏱️ {formatTime(timeLeft)}
                </div>
              )}
              <div className={styles.progress}>
                <span>{currentQ + 1} / {totalQuestions} Soal</span>
                <div className="progress-bar" style={{ width: '120px' }}>
                  <div
                    className="progress-fill"
                    style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Question */}
          <div className={styles.questionArea}>
            <div className={styles.qDots}>
              {shuffledQuestions.map((_, idx) => (
                <button
                  key={idx}
                  className={`${styles.qDot} ${idx === currentQ ? styles.qDotActive : ''} ${answers[idx] !== null ? styles.qDotAnswered : ''}`}
                  onClick={() => setCurrentQ(idx)}
                  title={`Pertanyaan ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <div className={styles.questionCard}>
              <div className={styles.qNum}>Pertanyaan {currentQ + 1} ({shuffledQuestions[currentQ].points || 10} Poin)</div>
              <h2 className={styles.question}>{shuffledQuestions[currentQ].question}</h2>

              <div className={styles.options}>
                {shuffledQuestions[currentQ].shuffledOptions.map((opt: any, optIdx: number) => (
                  <button
                    key={optIdx}
                    className={`${styles.option} ${
                      answers[currentQ] === opt.originalIndex ? styles.selected : ''
                    }`}
                    onClick={() => handleAnswer(currentQ, opt.originalIndex)}
                  >
                    <span className={styles.optionLetter}>
                      {['A', 'B', 'C', 'D'][optIdx]}
                    </span>
                    <span className={styles.optionText}>{opt.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className={styles.nav}>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
              >
                ← Sebelumnya
              </button>
              {currentQ < totalQuestions - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentQ(currentQ + 1)}
                >
                  Berikutnya →
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  title={!allAnswered ? 'Jawab semua pertanyaan dulu' : ''}
                >
                  ✅ Kumpulkan ({answeredCount}/{totalQuestions})
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Result Screen */
        <div className={styles.resultArea}>
          <div className={styles.resultCard}>
            <div className={styles.resultEmoji}>
              {score >= 80 ? '🎉' : score >= 60 ? '👍' : '📚'}
            </div>
            <h2 className={styles.resultTitle}>
              {isPreTest ? 'Pre-Test Selesai!' : 'Post-Test Selesai!'}
            </h2>
            <div className={styles.resultScoreCircle}>
              <svg viewBox="0 0 120 120" className={styles.scoreCircleSvg}>
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(79,70,229,0.06)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke={score >= 80 ? 'var(--status-ongoing)' : score >= 60 ? 'var(--status-upcoming)' : 'var(--primary-light)'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 339} 339`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              </svg>
              <span className={styles.scoreNumber}>{score}</span>
              <span className={styles.scoreUnit}>poin</span>
            </div>

            {!isPreTest && previousScore !== null && (
              <div className={styles.comparison}>
                <div className={styles.compItem}>
                  <span>Pre-Test</span>
                  <strong style={{ color: 'var(--status-upcoming)' }}>{previousScore}</strong>
                </div>
                <div className={styles.compArrow}>→</div>
                <div className={styles.compItem}>
                  <span>Post-Test</span>
                  <strong style={{ color: 'var(--status-ongoing)' }}>{score}</strong>
                </div>
                <div className={styles.compItem}>
                  <span>Peningkatan</span>
                  <strong style={{ color: 'var(--primary-light)' }}>
                    {score - previousScore > 0 ? '+' : ''}{score - previousScore}
                  </strong>
                </div>
              </div>
            )}

            <p className={styles.resultMessage}>
              {isPreTest
                ? 'Nilai pre-test telah tersimpan. Sekarang mulai pelajari materi yang tersedia!'
                : 'Selamat! Anda telah menyelesaikan seluruh pelatihan. Lihat statistik lengkap di dashboard.'}
            </p>

            <p className={styles.resultHint}>Mengarahkan Anda...</p>
          </div>
        </div>
      )}
    </div>
  );
}
