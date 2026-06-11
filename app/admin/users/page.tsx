'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAllUsers, updateUserProfile, updateUserRole, deleteUserProfile, createUserByAdmin, AppUser } from '@/lib/db';
import Link from 'next/link';
import styles from '../page.module.css';
import { Users, Pencil, Trash2, InboxIcon, Plus } from 'lucide-react';

export default function UsersDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [editRole, setEditRole] = useState<'admin' | 'instructor' | 'participant'>('participant');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addGender, setAddGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [addRole, setAddRole] = useState<'admin' | 'instructor' | 'participant'>('participant');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { router.push('/login'); return; }
    
    getAllUsers().then((u) => { setUsers(u); setDataLoading(false); });
  }, [user, isAdmin, loading, router]);

  const handleEdit = (u: AppUser) => {
    setEditingUser(u);
    setEditName(u.fullName || u.name || '');
    setEditGender(u.gender || 'Laki-laki');
    setEditRole(u.role || 'participant');
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await updateUserProfile(editingUser.id, { fullName: editName, gender: editGender });
      if (editRole !== editingUser.role) {
        await updateUserRole(editingUser.id, editRole);
      }
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, fullName: editName, gender: editGender, role: editRole } : u));
      setEditingUser(null);
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message || err}`);
    }
  };

  const handleAddUser = async () => {
    if (!addName || !addEmail) {
      alert("Nama dan Email wajib diisi!");
      return;
    }
    
    setIsAdding(true);
    try {
      const newUser = await createUserByAdmin({
        name: addName,
        email: addEmail,
        role: addRole,
        gender: addGender
      });
      setUsers(prev => [newUser, ...prev]);
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
    } catch (err: any) {
      alert(`Gagal menambahkan user: ${err.message || err}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`Hapus peserta ${u.fullName || u.name}? Tindakan ini akan menghapus data profil peserta.`)) return;
    try {
      await deleteUserProfile(u.id);
      setUsers(prev => prev.filter(user => user.id !== u.id));
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message || err}`);
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

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (u.fullName || u.name || '').toLowerCase().includes(q);
    const emailMatch = (u.email || '').toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  return (
    <div className={styles.page}>
      <div className="container">
        <div style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
          <Link href="/admin" style={{ color: 'var(--text-muted)' }}>← Kembali ke Panel Admin</Link>
        </div>
        
        <div className={styles.header}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              Keseluruhan Peserta <Users size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
            </h1>
            <p>Kelola dan reset data nama atau jenis kelamin peserta jika terjadi kesalahan input.</p>
          </div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Daftar Peserta</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', width: '250px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Cari nama atau email..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: '36px' }}
                />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Tambah User
              </button>
            </div>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><InboxIcon size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} /></div>
              <h3>Belum ada peserta terdaftar atau tidak ditemukan</h3>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Jenis Kelamin</th>
                    <th>Role</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName || u.name || '-'}</td>
                      <td>{u.email || '-'}</td>
                      <td>{u.gender || '-'}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-ongoing' : u.role === 'instructor' ? 'badge-upcoming' : 'badge-completed'}`}>
                          {u.role === 'admin' ? 'Admin' : u.role === 'instructor' ? 'Pengajar' : 'Peserta'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(u)}
                          >
                            <Pencil size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                            Hapus
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
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-input"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'instructor' | 'participant')}
                >
                  <option value="participant">Peserta</option>
                  <option value="instructor">Pengajar</option>
                  <option value="admin">Admin</option>
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

      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !isAdding && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Tambah User Baru</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => !isAdding && setShowAddModal(false)} disabled={isAdding}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input
                  type="text"
                  className="form-input"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Masukkan nama"
                  disabled={isAdding}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="Masukkan email"
                  disabled={isAdding}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-input"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'admin' | 'instructor' | 'participant')}
                  disabled={isAdding}
                >
                  <option value="participant">Peserta</option>
                  <option value="instructor">Pengajar</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Jenis Kelamin</label>
                <select
                  className="form-input"
                  value={addGender}
                  onChange={(e) => setAddGender(e.target.value as 'Laki-laki' | 'Perempuan')}
                  disabled={isAdding}
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={isAdding}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddUser} disabled={isAdding}>
                {isAdding ? 'Menambahkan...' : 'Tambah User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
