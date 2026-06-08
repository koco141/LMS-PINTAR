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
    <div className={styles.moduleContainer} style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, textAlign: 'center' }}>📝 {module.title}</h2>
          {isCompleted && <span className={styles.badgeCompleted} style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '12px', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>Selesai</span>}
        </div>
        
        <div className={styles.moduleDesc} style={{ marginBottom: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>{module.description || 'Tidak ada deskripsi penugasan.'}</p>
        </div>

        <div style={{ padding: '32px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', textAlign: 'center' }}>Link Pengumpulan Tugas</h3>
          
        {existingLink && (
          <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tugas Anda telah dikumpulkan:</p>
            <a href={existingLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: 'var(--primary)', fontWeight: '600' }}>
              {existingLink}
            </a>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>
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
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit} 
            disabled={submitting || !link.trim() || link === existingLink}
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
          >
            {submitting ? 'Mengumpulkan...' : (existingLink ? 'Perbarui Link Tugas' : 'Kumpulkan Tugas & Lanjut')}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
