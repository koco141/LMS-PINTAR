'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAllTrainings, deleteTraining, Training } from '@/lib/db';
import Link from 'next/link';
import styles from './page.module.css';

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeShareTraining, setActiveShareTraining] = useState<Training | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { router.push('/login'); return; }
    getAllTrainings().then((t) => { setTrainings(t); setDataLoading(false); });
  }, [user, isAdmin, loading]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus pelatihan "${title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await deleteTraining(id);
      setTrainings((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(`Gagal menghapus pelatihan: ${err.message || err}`);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Memuat panel admin...</p>
      </div>
    );
  }

  const totalParticipants = trainings.reduce((sum, t) => sum + (t.participantCount || 0), 0);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1>Panel Admin 🛠️</h1>
            <p>Selamat datang, {user?.displayName || 'Admin'}! Kelola semua pelatihan di sini.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/admin/users" className="btn btn-secondary">
              👥 Keseluruhan Peserta
            </Link>
            <Link href="/admin/trainings/new" className="btn btn-primary">
              ＋ Buat Pelatihan Baru
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '40px' }}>
          <div className="stat-card">
            <span className="stat-label">Total Pelatihan</span>
            <span className="stat-value">{trainings.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Berlangsung</span>
            <span className="stat-value" style={{ color: 'var(--status-ongoing)' }}>
              {trainings.filter((t) => t.status === 'ongoing').length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Akan Datang</span>
            <span className="stat-value" style={{ color: 'var(--status-upcoming)' }}>
              {trainings.filter((t) => t.status === 'upcoming').length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Peserta</span>
            <span className="stat-value">{totalParticipants}</span>
          </div>
        </div>

        {/* Trainings Table */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h3>Daftar Pelatihan</h3>
          </div>
          {trainings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>Belum ada pelatihan</h3>
              <p>Klik "Buat Pelatihan Baru" untuk memulai.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nama Pelatihan</th>
                    <th>Token</th>
                    <th>Status</th>
                    <th>Peserta</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map((training) => (
                    <tr key={training.id}>
                      <td>
                        <div className={styles.trainingName}>
                          <span className={styles.trainingTitle}>{training.title}</span>
                          <span className={styles.trainingDesc}>{training.description?.substring(0, 60)}...</span>
                        </div>
                      </td>
                      <td>
                        <code 
                          className={styles.tokenCode}
                          onClick={() => {
                            if (training.token) {
                              navigator.clipboard.writeText(training.token);
                              alert('📋 Token disalin ke clipboard!');
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Klik untuk menyalin"
                        >
                          {training.token}
                        </code>
                      </td>
                      <td>
                        <span className={`badge badge-${training.status}`}>
                          {training.status === 'ongoing' ? '🟢 Berlangsung' : training.status === 'upcoming' ? '🟡 Akan Datang' : '⚫ Selesai'}
                        </span>
                      </td>
                      <td>{training.participantCount}</td>
                      <td>
                        <div className={styles.actions} style={{ display: 'flex', gap: '6px' }}>
                          <Link href={`/admin/trainings/${training.id}`} className="btn btn-icon btn-secondary btn-sm" title="Kelola Pelatihan" style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✏️
                          </Link>
                          <Link href={`/admin/trainings/${training.id}/participants`} className="btn btn-icon btn-secondary btn-sm" title="Lihat Peserta" style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            👥
                          </Link>
                          <button
                            className="btn btn-icon btn-secondary btn-sm"
                            style={{ background: 'var(--primary-light)', color: 'white', border: 'none', width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setActiveShareTraining(training)}
                            title="Bagikan Pelatihan"
                          >
                            📢
                          </button>
                          <Link href={`/admin/trainings/${training.id}/analytics`} className="btn btn-icon btn-secondary btn-sm" title="Analisis Pelatihan" style={{ background: '#10b981', color: 'white', border: 'none', width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            📊
                          </Link>
                          <Link href={`/admin/trainings/${training.id}/testimonials`} className="btn btn-icon btn-secondary btn-sm" title="Testimoni" style={{ background: '#8b5cf6', color: 'white', border: 'none', width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            💬
                          </Link>
                          <Link href={`/admin/trainings/${training.id}/assignments`} className="btn btn-icon btn-secondary btn-sm" title="Nilai Tugas" style={{ background: '#f59e0b', color: 'white', border: 'none', width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            📝
                          </Link>
                          <button
                            className="btn btn-icon btn-danger btn-sm"
                            style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleDelete(training.id, training.title)}
                            title="Hapus Pelatihan"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Share Training Modal (Link & QR Code) ─── */}
      {activeShareTraining && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setActiveShareTraining(null)}>
          <div className="modal" style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 style={{ width: '100%' }}>📢 Bagikan Pelatihan</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setActiveShareTraining(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '24px 16px' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Gunakan link shareable atau QR code di bawah ini agar peserta dapat mendaftar pelatihan ini secara instan.
              </p>
              
              <div style={{
                background: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                display: 'inline-block',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '20px'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/training/${activeShareTraining.token}`
                      : `http://localhost:3000/training/${activeShareTraining.token || ''}`
                  )}`}
                  alt="QR Code Pelatihan"
                  style={{ display: 'block', width: '200px', height: '200px' }}
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Link Akses Pelatihan</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    readOnly
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/training/${activeShareTraining.token}`
                        : `http://localhost:3000/training/${activeShareTraining.token || ''}`
                    }
                    style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const shareUrl = typeof window !== 'undefined'
                        ? `${window.location.origin}/training/${activeShareTraining.token}`
                        : `http://localhost:3000/training/${activeShareTraining.token || ''}`;
                      navigator.clipboard.writeText(shareUrl);
                      alert('📋 Link disalin ke clipboard!');
                    }}
                  >
                    Salin
                  </button>
                </div>
              </div>

              <div style={{
                background: 'rgba(79, 70, 229, 0.06)',
                border: '1px solid rgba(79, 70, 229, 0.15)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span>🔑 Token Pelatihan:</span>
                <code style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary-light)', letterSpacing: '0.05em' }}>
                  {activeShareTraining.token}
                </code>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: '10px' }}>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/training/${activeShareTraining.token}`
                    : `http://localhost:3000/training/${activeShareTraining.token || ''}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                🖼️ Buka QR Code HD
              </a>
              <button className="btn btn-secondary" onClick={() => setActiveShareTraining(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
