'use client';

import { useState } from 'react';
import { Module } from '@/lib/db';
import styles from './ModuleViewer.module.css';

export default function EvaluationViewer({
  module,
  isCompleted,
  onComplete,
  onSubmitEvaluation,
  existingEvaluation
}: {
  module: Module;
  isCompleted: boolean;
  onComplete: () => void;
  onSubmitEvaluation: (ratings: Record<string, number>, testimonial: string) => Promise<void>;
  existingEvaluation?: { ratings: Record<string, number>, testimonial: string };
}) {
  const categories = module.ratingCategories || [];
  
  const [ratings, setRatings] = useState<Record<string, number>>(existingEvaluation?.ratings || {});
  const [testimonial, setTestimonial] = useState(existingEvaluation?.testimonial || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleStarClick = (category: string, value: number) => {
    if (existingEvaluation) return;
    setRatings(prev => ({ ...prev, [category]: value }));
  };

  const handleSubmit = async () => {
    setError('');
    // Validasi
    for (const cat of categories) {
      if (!ratings[cat]) {
        setError(`Harap berikan rating untuk ${cat}`);
        return;
      }
    }
    if (!testimonial.trim()) {
      setError('Harap isi kolom testimoni.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitEvaluation(ratings, testimonial);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan evaluasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.moduleContent}>
      <h2 style={{ marginBottom: '16px' }}>⭐ Evaluasi: {module.title}</h2>
      
      {module.description && (
        <div className={styles.moduleDescription} style={{ marginBottom: '24px' }}>
          <p>{module.description}</p>
        </div>
      )}

      {existingEvaluation && (
        <div className="alert alert-success" style={{ marginBottom: '24px', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
          <p>✅ Anda sudah mengisi evaluasi ini. Terima kasih atas masukannya!</p>
        </div>
      )}

      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Berikan Rating Anda</h3>
        
        {categories.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {categories.map((cat, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 500 }}>{cat}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleStarClick(cat, star)}
                      disabled={!!existingEvaluation}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: existingEvaluation ? 'default' : 'pointer',
                        color: (ratings[cat] || 0) >= star ? '#f59e0b' : 'var(--border-color)',
                        transition: 'color 0.2s',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '24px' }}>
            Tidak ada kategori rating spesifik yang ditentukan.
          </p>
        )}

        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label" style={{ fontWeight: 500 }}>Testimoni / Ulasan</label>
          <textarea
            className="form-input"
            rows={5}
            placeholder="Tuliskan testimoni atau ulasan Anda tentang pelatihan ini..."
            value={testimonial}
            onChange={(e) => setTestimonial(e.target.value)}
            disabled={!!existingEvaluation}
            style={{ width: '100%', padding: '12px', resize: 'vertical' }}
          ></textarea>
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>
        )}

        {!existingEvaluation && (
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '12px' }}
          >
            {isSubmitting ? 'Menyimpan...' : 'Kirim Evaluasi'}
          </button>
        )}
      </div>
    </div>
  );
}
