'use client';

import Link from 'next/link';
import { Training } from '@/lib/db';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import styles from './TrainingCard.module.css';

const COVER_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
];

interface Props {
  training: Training;
  index?: number;
}

const STATUS_MAP = {
  ongoing: { label: 'Berlangsung', className: 'badge-ongoing', dot: '🟢' },
  upcoming: { label: 'Akan Datang', className: 'badge-upcoming', dot: '🟡' },
  completed: { label: 'Selesai', className: 'badge-completed', dot: '⚫' },
};

export default function TrainingCard({ training, index = 0 }: Props) {
  const status = STATUS_MAP[training.status];
  const coverGradient = training.coverColor || COVER_COLORS[index % COVER_COLORS.length];

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'd MMM yyyy, HH:mm', { locale: idLocale });
  };

  const isImageCover = training.coverColor && (training.coverColor.startsWith('data:') || training.coverColor.startsWith('http') || !training.coverColor.includes('gradient'));
  const coverStyle = isImageCover 
    ? { backgroundImage: `url(${training.coverColor})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
    : { background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' };

  return (
    <div className={styles.card} style={{ animationDelay: `${index * 0.08}s` }}>
      {/* Cover */}
      <div className={styles.cover} style={coverStyle}>
        <div className={styles.coverOverlay} />
      </div>

      {/* Body */}
      <div className={styles.body}>
        <h3 className={styles.title}>{training.title}</h3>
        
        {/* Status Badge below title */}
        <div style={{ marginBottom: '4px', display: 'flex' }}>
          <span className={`badge ${status.className}`} style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: '600' }}>
            {status.dot} {status.label}
          </span>
        </div>

        <p className={styles.description}>{training.description}</p>

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>📅</span>
            <span>
              {formatDate(training.startDate)}
              {training.endDate && ` — ${formatDate(training.endDate)}`}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>👥</span>
            <span>{training.participantCount} peserta</span>
          </div>
        </div>

        <Link href={`/training/${training.token}`} className={styles.joinBtn}>
          {training.status === 'completed' ? '📊 Lihat Detail' : '▶ Masuk Pelatihan'}
        </Link>
      </div>
    </div>
  );
}
