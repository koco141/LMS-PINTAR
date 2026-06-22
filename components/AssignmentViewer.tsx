'use client';

import { useState, useEffect } from 'react';
import { Module } from '@/lib/db';
import styles from './ModuleViewer.module.css';
import { FileEdit } from 'lucide-react';
import Linkify from './Linkify';

export default function AssignmentViewer({
  module,
  isCompleted,
  onComplete,
  onSubmitLink,
  existingLink,
  existingText
}: {
  module: Module;
  isCompleted: boolean;
  onComplete: () => void;
  onSubmitLink: (link: string, text?: string) => Promise<void>;
  existingLink?: string;
  existingText?: string;
}) {
  const [link, setLink] = useState(existingLink || '');
  const [text, setText] = useState(existingText || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const type = module.submissionType || 'link';
  const requireLink = type === 'link' || type === 'both';
  const requireText = type === 'text' || type === 'both';

  useEffect(() => {
    setLink(existingLink || '');
    setText(existingText || '');
  }, [module.id, existingLink, existingText]);

  const now = new Date();
  const startDate = module.startDate ? new Date(module.startDate) : null;
  const endDate = module.endDate ? new Date(module.endDate) : null;

  const isTooEarly = startDate && now < startDate;
  const isTooLate = endDate && now > endDate;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleSubmit = async () => {
    if (requireLink && !link.trim()) {
      setError('Link pengumpulan tidak boleh kosong.');
      return;
    }
    if (requireText && !text.trim()) {
      setError('Teks jawaban tidak boleh kosong.');
      return;
    }

    setError('');
    setSubmitting(true);
    await onSubmitLink(requireLink ? link : '', requireText ? text : '');
    setSubmitting(false);
    onComplete();
  };

  const isFormValid = () => {
    if (requireLink && !link.trim()) return false;
    if (requireText && !text.trim()) return false;
    // Check if nothing changed
    if (link === (existingLink || '') && text === (existingText || '')) return false;
    return true;
  };

  return (
    <div className={styles.moduleContainer} style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, textAlign: 'center' }}>
            <FileEdit size={18} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary-light)' }} />
            {module.title}
          </h2>
          {isCompleted && <span className={styles.badgeCompleted} style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '12px', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>Selesai</span>}
        </div>
        
        <div className={styles.moduleDesc} style={{ marginBottom: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}><Linkify>{module.description || 'Tidak ada deskripsi penugasan.'}</Linkify></p>
        </div>

        <div style={{ padding: '32px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', textAlign: 'center' }}>Pengumpulan Tugas</h3>

          {isTooEarly && (
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#b45309', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Tugas Belum Dibuka</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>Tugas ini baru dapat diakses pada: <strong>{formatDate(module.startDate!)}</strong></p>
            </div>
          )}

          {isTooLate && (
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Waktu Habis</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>Batas waktu pengumpulan tugas ini telah berakhir pada: <strong>{formatDate(module.endDate!)}</strong></p>
            </div>
          )}

          {!isTooEarly && !isTooLate && endDate && (
            <div style={{ marginBottom: '24px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem' }}>
              Batas akhir pengumpulan: <strong>{formatDate(module.endDate!)}</strong>
            </div>
          )}
          
        {(existingLink || existingText) && (
          <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tugas Anda telah dikumpulkan:</p>
            {existingLink && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Link:</strong> <a href={existingLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: 'var(--primary)', fontWeight: '600' }}>{existingLink}</a>
              </div>
            )}
            {existingText && (
              <div>
                <strong>Jawaban:</strong>
                <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{existingText}</p>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {requireText && (
            <div className="form-group" style={{ marginBottom: 0, textAlign: 'left' }}>
              <label className="form-label" style={{ fontWeight: 500 }}>
                Jawaban / Deskripsi Tugas
              </label>
              <textarea 
                placeholder="Ketik jawaban Anda di sini..." 
                value={text} 
                onChange={(e) => setText(e.target.value)}
                disabled={Boolean(isTooEarly) || Boolean(isTooLate)}
                rows={5}
                style={{ 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: error && !text.trim() ? '1px solid var(--danger)' : '1px solid var(--border)',
                  backgroundColor: isTooEarly || isTooLate ? 'var(--bg-disabled, #e5e7eb)' : 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  opacity: isTooEarly || isTooLate ? 0.7 : 1,
                  resize: 'vertical'
                }}
              />
            </div>
          )}

          {requireLink && (
            <div className="form-group" style={{ marginBottom: 0, textAlign: 'left' }}>
              <label className="form-label" style={{ fontWeight: 500 }}>
                Masukkan Link Pengumpulan
              </label>
              <input 
                type="url" 
                placeholder="https://..." 
                value={link} 
                onChange={(e) => setLink(e.target.value)}
                disabled={Boolean(isTooEarly) || Boolean(isTooLate)}
                style={{ 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: error && !link.trim() ? '1px solid var(--danger)' : '1px solid var(--border)',
                  backgroundColor: isTooEarly || isTooLate ? 'var(--bg-disabled, #e5e7eb)' : 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '1rem',
                  opacity: isTooEarly || isTooLate ? 0.7 : 1
                }}
              />
            </div>
          )}
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '4px 0 0 0', textAlign: 'left' }}>{error}</p>}

          <button 
            className="btn btn-primary" 
            onClick={handleSubmit} 
            disabled={submitting || !isFormValid() || Boolean(isTooEarly) || Boolean(isTooLate)}
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
          >
            {submitting ? 'Mengumpulkan...' : ((existingLink || existingText) ? 'Perbarui Jawaban' : 'Kumpulkan Tugas & Lanjut')}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
