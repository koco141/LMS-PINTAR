'use client';

import { useState } from 'react';
import { Module } from '@/lib/db';
import styles from './ModuleViewer.module.css';

export default function AssignmentViewer({
  module,
  isCompleted,
  onComplete,
  onSubmitLink,
  existingLink
}: {
  module: Module;
  isCompleted: boolean;
  onComplete: () => void;
  onSubmitLink: (link: string) => Promise<void>;
  existingLink?: string;
}) {
  const [link, setLink] = useState(existingLink || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!link.trim()) return;
    setSubmitting(true);
    await onSubmitLink(link);
    setSubmitting(false);
    onComplete();
  };

  return (
    <div className={styles.moduleContainer}>
      <div className={styles.moduleHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2>📝 {module.title}</h2>
          {isCompleted && <span className={styles.badgeCompleted}>Selesai</span>}
        </div>
        <p className={styles.moduleDesc}>{module.description || 'Tidak ada deskripsi penugasan.'}</p>
      </div>

      <div style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Pengumpulan Tugas</h3>
        
        {existingLink && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tugas Anda telah dikumpulkan:</p>
            <a href={existingLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: 'var(--primary)', fontWeight: '600' }}>
              {existingLink}
            </a>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
            Masukkan Link Pengumpulan (Google Drive, Docs, dll)
          </label>
          <input 
            type="url" 
            placeholder="https://..." 
            value={link} 
            onChange={(e) => setLink(e.target.value)}
            style={{ 
              padding: '12px 16px', 
              borderRadius: '8px', 
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              width: '100%',
              fontSize: '1rem'
            }}
          />
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit} 
            disabled={submitting || !link.trim() || link === existingLink}
            style={{ alignSelf: 'flex-start', marginTop: '8px' }}
          >
            {submitting ? 'Mengumpulkan...' : (existingLink ? 'Perbarui Link Tugas' : 'Kumpulkan Tugas & Lanjut')}
          </button>
        </div>
      </div>
    </div>
  );
}
