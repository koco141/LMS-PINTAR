'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Training } from '@/lib/db';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import styles from './TrainingCard.module.css';
import { CalendarDays, Users, BarChart2, PlayCircle, Circle } from 'lucide-react';
import Linkify from './Linkify';

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
  isEnrolled?: boolean;
}

const STATUS_MAP = {
  ongoing: { label: 'Berlangsung', className: 'badge-ongoing' },
  upcoming: { label: 'Akan Datang', className: 'badge-upcoming' },
  completed: { label: 'Selesai', className: 'badge-completed' },
};

export default function TrainingCard({ training, index = 0, isEnrolled = false }: Props) {
  const router = useRouter();
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);
  const [inputToken, setInputToken] = useState('');
  const [error, setError] = useState('');

  const status = STATUS_MAP[training.status];
  const coverGradient = training.coverColor || COVER_COLORS[index % COVER_COLORS.length];

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'd MMM yyyy, HH:mm', { locale: idLocale });
  };

  const isImageCover = training.coverColor && (training.coverColor.startsWith('data:') || training.coverColor.startsWith('http') || !training.coverColor.includes('gradient'));
  
  const coverStyle = !isImageCover 
    ? { background: training.coverColor || coverGradient }
    : undefined;

  return (
    <div className={styles.card} style={{ animationDelay: `${index * 0.08}s` }}>
      {/* Cover */}
      <div className={styles.cover} style={coverStyle}>
        {isImageCover && (
          <Image 
            src={training.coverColor!} 
            alt={training.title} 
            fill 
            style={{ objectFit: 'cover' }} 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        )}
        <div className={styles.coverOverlay} />
      </div>

      {/* Body */}
      <div className={styles.body}>
        <h3 className={styles.title}>{training.title}</h3>
        
        {/* Status Badge below title */}
        <div style={{ marginBottom: '4px', display: 'flex' }}>
          <span className={`badge ${status.className}`} style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: '600' }}>
            <Circle size={7} fill="currentColor" style={{ marginRight: '5px', verticalAlign: 'middle' }} />
            {status.label}
          </span>
        </div>

        <p className={styles.description}><Linkify>{training.description}</Linkify></p>

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}><CalendarDays size={14} /></span>
            <span>
              {formatDate(training.startDate)}
              {training.endDate && ` — ${formatDate(training.endDate)}`}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}><Users size={14} /></span>
            <span>{training.participantCount} peserta</span>
          </div>
        </div>

        {!showTokenPrompt ? (
          <button 
            onClick={() => {
              if (isEnrolled) {
                router.push(`/training/${training.token}`);
              } else {
                setShowTokenPrompt(true);
              }
            }} 
            className={styles.joinBtn}
            style={{ width: '100%', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {training.status === 'completed'
              ? <><BarChart2 size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Lihat Detail</>
              : <><PlayCircle size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Masuk Pelatihan</>
            }
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Masukkan Token Pelatihan:
            </p>
            <input 
              type="text" 
              placeholder="Contoh: ABC123" 
              className="form-input"
              value={inputToken}
              onChange={(e) => { setInputToken(e.target.value.toUpperCase()); setError(''); }}
              style={{ fontSize: '0.85rem', padding: '8px' }}
              autoComplete="off"
            />
            {error && <span style={{ color: 'var(--status-upcoming)', fontSize: '0.75rem', fontWeight: 600 }}>{error}</span>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1, padding: '6px' }}
                onClick={() => {
                  if (inputToken === training.token) {
                    router.push(`/training/${training.token}`);
                  } else {
                    setError('Token tidak sesuai.');
                  }
                }}
              >
                Validasi
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 12px' }}
                onClick={() => { setShowTokenPrompt(false); setInputToken(''); setError(''); }}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
