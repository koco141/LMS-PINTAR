'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateUserProfile } from '@/lib/db';

export default function CompleteProfileModal() {
  const { user, userProfile, loading, refreshUserProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && userProfile) {
      if (!userProfile.fullName || !userProfile.gender) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  }, [user, userProfile, loading]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !gender) return;
    
    setIsSubmitting(true);
    try {
      await updateUserProfile(user!.uid, { 
        fullName: fullName.trim(), 
        gender: gender as 'Laki-laki' | 'Perempuan'
      });
      await refreshUserProfile();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Gagal menyimpan profil. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '32px',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Lengkapi Profil Anda
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Mohon lengkapi nama asli dan jenis kelamin Anda untuk keperluan sertifikat dan leaderboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Nama Lengkap</label>
            <input
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Jenis Kelamin</label>
            <select
              className="form-input"
              value={gender}
              onChange={(e) => setGender(e.target.value as 'Laki-laki' | 'Perempuan')}
              required
            >
              <option value="" disabled>Pilih Jenis Kelamin...</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isSubmitting || !fullName.trim() || !gender}
            style={{ marginTop: '8px', padding: '12px' }}
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </form>
      </div>
    </div>
  );
}
