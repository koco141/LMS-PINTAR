'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAllUsers, updateUserProfile, AppUser } from '@/lib/db';
import Link from 'next/link';
import styles from '../page.module.css';

export default function UsersDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { router.push('/login'); return; }
    
    getAllUsers().then((u) => { setUsers(u); setDataLoading(false); });
  }, [user, isAdmin, loading, router]);

  const handleEdit = (u: AppUser) => {
    setEditingUser(u);
    setEditName(u.fullName || u.name || '');
    setEditGender(u.gender || 'Laki-laki');
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await updateUserProfile(editingUser.id, { fullName: editName, gender: editGender });
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, fullName: editName, gender: editGender } : u));
      setEditingUser(null);
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message || err}`);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Memuat daftar peserta...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
          <Link href="/admin" style={{ color: 'var(--text-muted)' }}>← Kembali ke Panel Admin</Link>
        </div>
        
        <div className={styles.header}>
          <div>
            <h1>Keseluruhan Peserta 👥</h1>
            <p>Kelola dan reset data nama atau jenis kelamin peserta jika terjadi kesalahan input.</p>
          </div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h3>Daftar Peserta</h3>
          </div>
          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>Belum ada peserta terdaftar</h3>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Jenis Kelamin</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName || u.name || '-'}</td>
                      <td>{u.email || '-'}</td>
                      <td>{u.gender || '-'}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(u)}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Edit Peserta</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Jenis Kelamin</label>
                <select
                  className="form-input"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as 'Laki-laki' | 'Perempuan')}
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave}>Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
