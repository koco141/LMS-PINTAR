'use client';

import { useState } from 'react';
import { Module } from '@/lib/db';
import styles from './ModuleViewer.module.css';

function StarRating({ value, onChange, disabled }: { value: number, onChange: (v: number) => void, disabled?: boolean }) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div 
      style={{ display: 'flex', gap: '4px' }}
      onMouseLeave={() => setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <div 
          key={star} 
          style={{ position: 'relative', width: '28px', height: '28px' }}
        >
          {/* Background star (empty) */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-color, #ccc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>

          {/* Filled star */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ 
            position: 'absolute', top: 0, left: 0, pointerEvents: 'none',
            clipPath: displayValue >= star ? 'none' : (displayValue >= star - 0.5 ? 'inset(0 50% 0 0)' : 'inset(0 100% 0 0)')
          }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>

          {/* Hit areas */}
          <div 
            style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', cursor: disabled ? 'default' : 'pointer' }}
            onMouseEnter={() => !disabled && setHoverValue(star - 0.5)}
            onClick={() => !disabled && onChange(star - 0.5)}
          />
          <div 
            style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', cursor: disabled ? 'default' : 'pointer' }}
            onMouseEnter={() => !disabled && setHoverValue(star)}
            onClick={() => !disabled && onChange(star)}
          />
        </div>
      ))}
      <span style={{ marginLeft: '8px', fontWeight: 600, color: '#f59e0b', alignSelf: 'center', minWidth: '24px' }}>
        {displayValue > 0 ? displayValue : ''}
      </span>
    </div>
  );
}

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
  const categories = module.ratingCategories && module.ratingCategories.length > 0 
    ? module.ratingCategories 
    : ['Rating'];

  
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
    <div className={styles.moduleContent} style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <h2 style={{ marginBottom: '16px', textAlign: 'center' }}>⭐ Evaluasi</h2>
        
        {module.description && (
          <div className={styles.moduleDescription} style={{ marginBottom: '24px', textAlign: 'center' }}>
            <p>{module.description}</p>
          </div>
        )}

        {existingEvaluation && (
          <div className="alert alert-success" style={{ marginBottom: '24px', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
            <p>✅ Anda sudah mengisi evaluasi ini. Terima kasih atas masukannya!</p>
          </div>
        )}

        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', textAlign: 'center' }}>Berikan Rating Anda: {module.title}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {categories.map((cat, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 500, minWidth: '80px' }}>{cat}</span>
                <StarRating 
                  value={ratings[cat] || 0} 
                  onChange={(val) => handleStarClick(cat, val)} 
                  disabled={!!existingEvaluation} 
                />
              </div>
            ))}
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ fontWeight: 500 }}>Ulasan (Opsional)</label>
            <textarea
              className="form-input"
              rows={5}
              placeholder="Tuliskan ulasan Anda tentang pelatihan ini..."
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              disabled={!!existingEvaluation}
              style={{ width: '100%', padding: '12px', resize: 'vertical' }}
            ></textarea>
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>
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
    </div>
  );
}
