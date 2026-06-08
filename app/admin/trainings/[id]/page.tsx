'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getTrainingById, getModules, getQuiz, updateTraining, deleteTraining,
  createModule, updateModule, deleteModule, saveQuiz, updateModuleOrders,
  Training, Module, Quiz, QuizQuestion,
  generateToken,
} from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import styles from './page.module.css';
import * as XLSX from 'xlsx';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type AdminTab = 'info' | 'modules' | 'pre-test' | 'post-test';

const DEFAULT_COVER = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';

export default function TrainingAdminPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [preTest, setPreTest] = useState<Quiz | null>(null);
  const [postTest, setPostTest] = useState<Quiz | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('info');
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  // Module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState<{title: string, embedUrl: string, description: string, type: 'materi'|'tugas'|'evaluasi', ratingCategories: string[]}>({ title: '', embedUrl: '', description: '', type: 'materi', ratingCategories: [] });

  // Info form
  const [infoForm, setInfoForm] = useState({
    title: '', description: '', status: 'upcoming', coverColor: DEFAULT_COVER,
    startDate: '', endDate: '', showLeaderboard: false, assignmentLink: '', targetLevel: 5,
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push('/login');
    if (!loading && user && isAdmin) loadAll();
  }, [user, isAdmin, loading, id]);

  const formatToDateTimeLocal = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const calculateStatus = (startStr: string, endStr: string): 'upcoming' | 'ongoing' | 'completed' => {
    if (!startStr) return 'ongoing';
    const now = new Date();
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;

    if (now < start) return 'upcoming';
    if (end && now > end) return 'completed';
    return 'ongoing';
  };

  const loadAll = async () => {
    const [t, mods, pre, post] = await Promise.all([
      getTrainingById(id),
      getModules(id),
      getQuiz(id, 'pre-test'),
      getQuiz(id, 'post-test'),
    ]);
    if (t) {
      setTraining(t);
      setInfoForm({
        title: t.title,
        description: t.description,
        status: t.status,
        coverColor: t.coverColor || DEFAULT_COVER,
        startDate: t.startDate ? formatToDateTimeLocal(t.startDate) : '',
        endDate: t.endDate ? formatToDateTimeLocal(t.endDate) : '',
        showLeaderboard: t.showLeaderboard,
        targetLevel: t.targetLevel || 5,
        assignmentLink: t.assignmentLink || '',
      });
    }
    setModules(mods);
    setPreTest(pre);
    setPostTest(post);
    setPageLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ─── Info Save ──────────────────────────────────────────────────────────
  const saveInfo = async () => {
    setSaving(true);
    const computedStatus = calculateStatus(infoForm.startDate, infoForm.endDate);
    await updateTraining(id, {
      title: infoForm.title,
      description: infoForm.description,
      status: computedStatus,
      coverColor: infoForm.coverColor,
      startDate: infoForm.startDate ? Timestamp.fromDate(new Date(infoForm.startDate)) : null,
      endDate: infoForm.endDate ? Timestamp.fromDate(new Date(infoForm.endDate)) : null,
      showLeaderboard: infoForm.showLeaderboard,
      targetLevel: infoForm.targetLevel,
      assignmentLink: infoForm.assignmentLink,
    });
    await loadAll();
    setSaving(false);
    showToast('✅ Info pelatihan berhasil disimpan!');
  };

  // ─── Module CRUD ─────────────────────────────────────────────────────────
  const openModuleForm = (mod?: Module, type: 'materi' | 'tugas' | 'evaluasi' = 'materi') => {
    if (mod) {
      setEditingModule(mod);
      setModuleForm({ title: mod.title, embedUrl: mod.embedUrl || '', description: mod.description || '', type: mod.type || 'materi', ratingCategories: mod.ratingCategories || [] });
    } else {
      setEditingModule(null);
      setModuleForm({ title: '', embedUrl: '', description: '', type, ratingCategories: [] });
    }
    setShowModuleForm(true);
  };

  const saveModule = async () => {
    if (!moduleForm.title.trim()) return;
    if (moduleForm.type === 'materi' && !moduleForm.embedUrl.trim()) return;
    setSaving(true);
    
    const dataToSave: Partial<Module> = {
      title: moduleForm.title,
      description: moduleForm.description,
      type: moduleForm.type,
    };
    if (moduleForm.type === 'materi') {
      dataToSave.embedUrl = moduleForm.embedUrl;
    } else {
      dataToSave.embedUrl = '';
    }
    if (moduleForm.type === 'evaluasi') {
      dataToSave.ratingCategories = moduleForm.ratingCategories;
    }

    if (editingModule) {
      await updateModule(id, editingModule.id, dataToSave);
    } else {
      await createModule(id, { ...dataToSave, embedUrl: dataToSave.embedUrl || '', order: modules.length } as Omit<Module, 'id' | 'trainingId' | 'createdAt'>);
    }
    await loadAll();
    setShowModuleForm(false);
    setSaving(false);
    showToast(editingModule ? '✅ Modul diperbarui!' : '✅ Modul ditambahkan!');
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(modules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setModules(items);

    try {
      await updateModuleOrders(id, items.map(i => i.id));
      showToast('✅ Urutan modul diperbarui!');
    } catch (e) {
      showToast('❌ Gagal memperbarui urutan modul.');
      loadAll();
    }
  };
  
  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Hapus modul ini?')) return;
    await deleteModule(id, moduleId);
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
    showToast('🗑️ Modul dihapus.');
  };

  // ─── Delete Training ─────────────────────────────────────────────────────
  const handleDeleteTraining = async () => {
    if (!confirm(`Hapus pelatihan "${training?.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await deleteTraining(id);
    router.push('/admin');
  };

  if (pageLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className="container">
        <div className={styles.breadcrumb}>
          <Link href="/admin">Admin</Link>
          <span>›</span>
          <span>{training?.title}</span>
        </div>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{training?.title}</h1>
            <div className={styles.tokenBadge}>
              <span>🔑 Token:</span>
              <code className={styles.token}>{training?.token}</code>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { navigator.clipboard.writeText(training?.token || ''); showToast('📋 Token disalin!'); }}
              >
                📋 Salin
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-light)', borderColor: 'var(--primary)' }}
                onClick={() => setShowShareModal(true)}
              >
                📢 Bagikan
              </button>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link href={`/admin/trainings/${id}/analytics`} className="btn btn-secondary">
              📊 Analisis
            </Link>
            <Link href={`/admin/trainings/${id}/testimonials`} className="btn btn-secondary">
              💬 Testimoni
            </Link>
            <Link href={`/admin/trainings/${id}/participants`} className="btn btn-secondary">
              👥 Lihat Peserta
            </Link>
            <button className="btn btn-danger" onClick={handleDeleteTraining}>
              🗑️ Hapus
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['info', 'modules', 'pre-test', 'post-test'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'info' ? '📋 Info' : tab === 'modules' ? `📚 Materi (${modules.length})` : tab === 'pre-test' ? '📝 Pre-Test' : '📋 Post-Test'}
            </button>
          ))}
        </div>

        {/* ─── Info Tab ─── */}
        {activeTab === 'info' && (
          <div className={styles.tabContent}>
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">Nama Pelatihan</label>
                <input className="form-input" value={infoForm.title} onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Deskripsi</label>
                <textarea className="form-textarea" value={infoForm.description} onChange={(e) => setInfoForm({ ...infoForm, description: e.target.value })} rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Level Kompetensi Pelatihan</label>
                <select
                  className="form-input"
                  value={infoForm.targetLevel}
                  onChange={(e) => setInfoForm({ ...infoForm, targetLevel: Number(e.target.value) })}
                >
                  <option value={1}>Level 1 (Pemula/Paham) - Pengetahuan dasar teori, belum berpengalaman praktik</option>
                  <option value={2}>Level 2 (Mampu/Dasar) - Menerapkan pengetahuan dasar untuk tugas rutin</option>
                  <option value={3}>Level 3 (Kompeten/Mahir) - Mengevaluasi situasi dan memecahkan masalah kompleks</option>
                  <option value={4}>Level 4 (Ahli/Superior) - Performa superior dan sering menjadi rujukan</option>
                  <option value={5}>Level 5 (Master/Pakar) - Puncak keahlian, mampu membimbing orang lain</option>
                </select>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Pilih level maksimal (Target/Tujuan) kompetensi yang diharapkan dapat dicapai peserta setelah menyelesaikan pelatihan ini.
                </p>
              </div>

              <div className={styles.formRow3}>
                <div className="form-group">
                  <label className="form-label">Status (Otomatis)</label>
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '42px',
                    fontSize: '0.9rem'
                  }}>
                    {infoForm.status === 'ongoing' ? '🟢 Berlangsung' : infoForm.status === 'upcoming' ? '🟡 Akan Datang' : '⚫ Selesai'}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal & Jam Mulai</label>
                  <input className="form-input" type="datetime-local" value={infoForm.startDate} onChange={(e) => {
                    const start = e.target.value;
                    setInfoForm({ ...infoForm, startDate: start, status: calculateStatus(start, infoForm.endDate) });
                  }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal & Jam Selesai</label>
                  <input className="form-input" type="datetime-local" value={infoForm.endDate} onChange={(e) => {
                    const end = e.target.value;
                    setInfoForm({ ...infoForm, endDate: end, status: calculateStatus(infoForm.startDate, end) });
                  }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Gambar Cover (Maksimal 1 MB)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {infoForm.coverColor && (infoForm.coverColor.startsWith('data:') || infoForm.coverColor.startsWith('http') || !infoForm.coverColor.includes('gradient')) ? (
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: '160px',
                      borderRadius: '8px',
                      backgroundImage: `url(${infoForm.coverColor})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: '12px'
                    }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ position: 'absolute', top: '10px', right: '10px', padding: '6px 10px', minWidth: 'auto', zIndex: 10 }}
                        onClick={() => setInfoForm({ ...infoForm, coverColor: DEFAULT_COVER })}
                      >
                        🗑️ Hapus Gambar
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100px',
                      borderRadius: '8px',
                      background: DEFAULT_COVER,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem'
                    }}>
                      Menggunakan cover warna default (Klik upload untuk mengubah)
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) {
                        alert('Format file tidak didukung. Pilih file gambar (JPG, PNG, WEBP).');
                        return;
                      }
                      if (file.size > 1048576) {
                        alert(`Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal ukuran file adalah 1 MB.`);
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setInfoForm({ ...infoForm, coverColor: base64 });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="form-input"
                    style={{ display: 'block', padding: '8px' }}
                  />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Format JPG, PNG, WEBP. Maksimal ukuran file 1 MB.
                  </p>
                </div>
              </div>
              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Tampilkan Leaderboard ke Peserta</p>
                  <p className={styles.toggleHint}>Jika aktif, peserta bisa lihat peringkat</p>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={infoForm.showLeaderboard} onChange={(e) => setInfoForm({ ...infoForm, showLeaderboard: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>
              {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
            </button>
          </div>
        )}

        {/* ─── Modules Tab ─── */}
        {activeTab === 'modules' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionBar}>
              <h3>Daftar Materi</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openModuleForm(undefined, 'materi')}>
                  ＋ Tambah Materi
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openModuleForm(undefined, 'tugas')}>
                  📝 Tugas
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openModuleForm(undefined, 'evaluasi')}>
                  ⭐ Evaluasi
                </button>
              </div>
            </div>

            {modules.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <h3>Belum ada modul</h3>
                <p>Tambahkan modul materi, tugas, atau evaluasi.</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="modules">
                  {(provided) => (
                    <div className={styles.moduleList} {...provided.droppableProps} ref={provided.innerRef}>
                      {modules.map((mod, idx) => (
                        <Draggable key={mod.id} draggableId={mod.id} index={idx}>
                          {(provided) => (
                            <div 
                              className={styles.moduleCard}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                            >
                              <div className={styles.moduleDragHandle} {...provided.dragHandleProps} style={{ cursor: 'grab', marginRight: '10px', color: 'var(--text-muted)' }}>
                                ⋮⋮
                              </div>
                              <div className={styles.moduleNum}>{idx + 1}</div>
                              <div className={styles.moduleInfo}>
                                <h4>
                                  {(!mod.type || mod.type === 'materi') && '📚 '}
                                  {mod.type === 'tugas' && '📝 '}
                                  {mod.type === 'evaluasi' && '⭐ '}
                                  {mod.title}
                                </h4>
                                <p>{mod.description}</p>
                                {(!mod.type || mod.type === 'materi') && (
                                  <code className={styles.embedUrl}>{mod.embedUrl.substring(0, 60)}...</code>
                                )}
                              </div>
                              <div className={styles.moduleActions}>

                                <button className="btn btn-secondary btn-sm" onClick={() => openModuleForm(mod)}>✏️</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteModule(mod.id)}>🗑️</button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            {/* Module Form Modal */}
            {showModuleForm && (
              <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModuleForm(false)}>
                <div className="modal">
                  <div className="modal-header">
                    <h3>{editingModule ? 'Edit Modul' : `Tambah ${moduleForm.type === 'materi' ? 'Materi' : moduleForm.type === 'tugas' ? 'Tugas' : 'Evaluasi'}`}</h3>
                    <button className="btn btn-icon btn-secondary" onClick={() => setShowModuleForm(false)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Judul {moduleForm.type === 'materi' ? 'Materi' : moduleForm.type === 'tugas' ? 'Tugas' : 'Evaluasi'} *</label>
                        <input className="form-input" placeholder="Judul"
                          value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} />
                      </div>
                      
                      {moduleForm.type === 'evaluasi' && (
                        <div className="form-group">
                          <label className="form-label">Kategori Rating</label>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Tambahkan kategori apa saja yang ingin dirating oleh peserta (contoh: Instruktur, Materi, Penyelenggara).
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            {moduleForm.ratingCategories?.map((cat, i) => (
                              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  className="form-input" 
                                  value={cat} 
                                  onChange={(e) => {
                                    const newCats = [...(moduleForm.ratingCategories || [])];
                                    newCats[i] = e.target.value;
                                    setModuleForm({ ...moduleForm, ratingCategories: newCats });
                                  }}
                                />
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={() => {
                                    const newCats = [...(moduleForm.ratingCategories || [])];
                                    newCats.splice(i, 1);
                                    setModuleForm({ ...moduleForm, ratingCategories: newCats });
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => setModuleForm({ ...moduleForm, ratingCategories: [...(moduleForm.ratingCategories || []), 'Kategori Baru'] })}
                          >
                            + Tambah Kategori Rating
                          </button>
                        </div>
                      )}

                      {(!moduleForm.type || moduleForm.type === 'materi') && (
                        <div className="form-group">
                          <label className="form-label">Link Google Slides (Publish URL) *</label>
                          <input className="form-input"
                            placeholder="https://docs.google.com/presentation/d/.../pub?..."
                            value={moduleForm.embedUrl} onChange={(e) => setModuleForm({ ...moduleForm, embedUrl: e.target.value })} />
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            File → Bagikan → Terbitkan ke web → Embed atau salin link
                          </p>
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">{moduleForm.type === 'tugas' ? 'Deskripsi Penugasan' : 'Deskripsi Singkat'}</label>
                        <textarea className="form-textarea" placeholder={moduleForm.type === 'tugas' ? 'Jelaskan apa yang harus dikerjakan peserta...' : 'Deskripsi...'}
                          value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} rows={4} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowModuleForm(false)}>Batal</button>
                    <button className="btn btn-primary" onClick={saveModule} disabled={saving || !moduleForm.title || (moduleForm.type === 'materi' && !moduleForm.embedUrl)}>
                      {saving ? 'Menyimpan...' : '💾 Simpan'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}



        {/* ─── Quiz Tabs ─── */}
        {(activeTab === 'pre-test' || activeTab === 'post-test') && (
          <QuizEditor
            trainingId={id}
            type={activeTab}
            quiz={activeTab === 'pre-test' ? preTest : postTest}
            onSaved={() => { loadAll(); showToast('✅ Kuis berhasil disimpan!'); }}
          />
        )}
      </div>

      {/* ─── Share Training Modal (Link & QR Code) ─── */}
      {showShareModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowShareModal(false)}>
          <div className="modal" style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 style={{ width: '100%' }}>📢 Bagikan Pelatihan</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowShareModal(false)}>✕</button>
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
                      ? `${window.location.origin}/training/${training?.token}`
                      : `http://localhost:3000/training/${training?.token || ''}`
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
                        ? `${window.location.origin}/training/${training?.token}`
                        : `http://localhost:3000/training/${training?.token || ''}`
                    }
                    style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const shareUrl = typeof window !== 'undefined'
                        ? `${window.location.origin}/training/${training?.token}`
                        : `http://localhost:3000/training/${training?.token || ''}`;
                      navigator.clipboard.writeText(shareUrl);
                      showToast('📋 Link disalin!');
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
                  {training?.token}
                </code>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: '10px' }}>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/training/${training?.token}`
                    : `http://localhost:3000/training/${training?.token || ''}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                🖼️ Buka QR Code HD
              </a>
              <button className="btn btn-secondary" onClick={() => setShowShareModal(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quiz Editor Component ──────────────────────────────────────────────────
function QuizEditor({
  trainingId,
  type,
  quiz,
  onSaved,
}: {
  trainingId: string;
  type: 'pre-test' | 'post-test';
  quiz: Quiz | null;
  onSaved: (newQuizId?: string) => void;
}) {
  const [title, setTitle] = useState(quiz?.title || (type === 'pre-test' ? 'Pre-Test' : 'Post-Test'));
  const [duration, setDuration] = useState<number>(quiz?.duration || 0);
  const [syncToPostTest, setSyncToPostTest] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    quiz?.questions || []
  );
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const downloadExcelTemplate = () => {
    const headers = [
      'No',
      'Pertanyaan *',
      'Pilihan A *',
      'Pilihan B *',
      'Pilihan C *',
      'Pilihan D *',
      'Kunci Jawaban (A/B/C/D) *',
      'Poin',
      'Kategori'
    ];
    const sampleData = [
      [
        1,
        'Apa kepanjangan dari AI?',
        'Artificial Intelligence',
        'Apple Intel',
        'Adobe Illustrator',
        'All In',
        'A',
        10,
        'Teori'
      ],
      [
        2,
        'Negara manakah yang memenangkan Piala Dunia FIFA 2022?',
        'Prancis',
        'Argentina',
        'Kroasia',
        'Maroko',
        'B',
        10,
        'Teori'
      ]
    ];

    const worksheetData = [headers, ...sampleData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    const wscols = [
      { wch: 6 },
      { wch: 50 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 8 },
      { wch: 20 }
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Soal');
    
    XLSX.writeFile(workbook, 'Template_Soal_PintarLMS.xlsx');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        if (jsonData.length <= 1) {
          alert('Excel kosong atau tidak memiliki data.');
          return;
        }

        const imported: QuizQuestion[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;

          const question = row[1] ? String(row[1]).trim() : '';
          if (!question) continue;

          const options = [
            row[2] ? String(row[2]).trim() : '',
            row[3] ? String(row[3]).trim() : '',
            row[4] ? String(row[4]).trim() : '',
            row[5] ? String(row[5]).trim() : '',
          ];

          const rawKey = row[6] ? String(row[6]).trim().toUpperCase() : 'A';
          const correctAnswer = ['A', 'B', 'C', 'D'].indexOf(rawKey);
          const points = typeof row[7] === 'number' ? row[7] : (parseInt(row[7]) || 10);
          const category = row[8] ? String(row[8]).trim() : 'Teori';

          imported.push({
            id: (Date.now() + i).toString(),
            question,
            options,
            correctAnswer: correctAnswer !== -1 ? correctAnswer : 0,
            points,
            category,
          });
        }

        if (imported.length > 0) {
          setQuestions([...questions, ...imported]);
          setShowImport(false);
          alert(`Berhasil mengimpor ${imported.length} soal dari Excel!`);
        } else {
          alert('Tidak ada soal valid yang berhasil diimpor. Pastikan template sesuai.');
        }
      } catch (err) {
        console.error(err);
        alert('Gagal membaca file Excel. Pastikan format file benar.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Sync duration changes when quiz changes
  useEffect(() => {
    setTitle(quiz?.title || (type === 'pre-test' ? 'Pre-Test' : 'Post-Test'));
    setDuration(quiz?.duration || 0);
    setQuestions(quiz?.questions || []);
  }, [quiz, type]);

  const addQuestion = () => {
    setQuestions([...questions, {
      id: Date.now().toString(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 10,
      category: 'Teori',
    }]);
  };

  const updateQuestion = (idx: number, field: keyof QuizQuestion, value: any) => {
    const updated = [...questions];
    (updated[idx] as any)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (questions.length === 0) { alert('Tambahkan minimal 1 pertanyaan.'); return; }
    setSaving(true);
    const finalQuizId = await saveQuiz(trainingId, type, { type, title, questions, duration }, type === 'pre-test' ? syncToPostTest : false);
    setSaving(false);
    onSaved(finalQuizId);
  };

  const handleImport = () => {
    try {
      const text = importText.trim();
      if (!text) return;

      let importedQuestions: QuizQuestion[] = [];

      if (text.startsWith('[')) {
        // Parse JSON format
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          importedQuestions = parsed.map((q: any, i: number) => ({
            id: (Date.now() + i).toString(),
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
            correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
            points: typeof q.points === 'number' ? q.points : 10,
            category: q.category || 'Teori',
          }));
        }
      } else {
        // Parse structured text format
        const blocks = text.split(/Soal:\s*/i);
        blocks.forEach((block, idx) => {
          if (!block.trim()) return;

          const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
          const question = lines[0] || '';
          const options: string[] = ['', '', '', ''];
          let correctAnswer = 0;
          let points = 10;
          let category = 'Teori';

          lines.forEach((line) => {
            const aMatch = line.match(/^A\.\s*(.*)/i);
            const bMatch = line.match(/^B\.\s*(.*)/i);
            const cMatch = line.match(/^C\.\s*(.*)/i);
            const dMatch = line.match(/^D\.\s*(.*)/i);
            const keyMatch = line.match(/^Kunci:\s*([A-D])/i);
            const pointsMatch = line.match(/^Poin:\s*(\d+)/i);
            const categoryMatch = line.match(/^Kategori:\s*(.*)/i);

            if (aMatch) options[0] = aMatch[1];
            else if (bMatch) options[1] = bMatch[1];
            else if (cMatch) options[2] = cMatch[1];
            else if (dMatch) options[3] = dMatch[1];
            else if (keyMatch) {
              const letter = keyMatch[1].toUpperCase();
              correctAnswer = ['A', 'B', 'C', 'D'].indexOf(letter);
              if (correctAnswer === -1) correctAnswer = 0;
            } else if (pointsMatch) {
              points = parseInt(pointsMatch[1]) || 10;
            } else if (categoryMatch) {
              category = categoryMatch[1].trim();
            }
          });

          importedQuestions.push({
            id: (Date.now() + idx).toString(),
            question,
            options,
            correctAnswer,
            points,
            category,
          });
        });
      }

      if (importedQuestions.length > 0) {
        setQuestions([...questions, ...importedQuestions]);
        setShowImport(false);
        setImportText('');
        alert(`Berhasil mengimpor ${importedQuestions.length} soal!`);
      } else {
        alert('Gagal mendeteksi soal. Periksa kembali format input Anda.');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat mengimpor soal. Periksa format penulisan.');
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionBar}>
        <div>
          <h3>{type === 'pre-test' ? '📝 Pre-Test' : '📋 Post-Test'}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {type === 'pre-test' ? 'Dikerjakan sebelum materi.' : 'Dikerjakan setelah semua materi selesai.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>📥 Import Soal</button>
          <button className="btn btn-secondary btn-sm" onClick={addQuestion}>＋ Tambah Soal</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : '💾 Simpan Kuis'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div className="form-group" style={{ flex: '1', minWidth: '250px' }}>
          <label className="form-label">Judul Kuis</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group" style={{ width: '180px' }}>
          <label className="form-label">Durasi Kuis (Menit)</label>
          <input 
            className="form-input" 
            type="number" 
            min="0" 
            value={duration} 
            onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="0 = Tanpa batas" 
          />
        </div>
      </div>

      {type === 'pre-test' && (
        <div className={styles.toggleRow} style={{ maxWidth: '600px', padding: '12px 16px', margin: '8px 0 20px' }}>
          <div>
            <p className={styles.toggleLabel} style={{ fontSize: '0.85rem' }}>Duplikasikan soal ke Post-Test otomatis</p>
            <p className={styles.toggleHint} style={{ fontSize: '0.75rem' }}>Menyalin kuis Pre-Test ini langsung menjadi Post-Test saat disimpan</p>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={syncToPostTest} onChange={(e) => setSyncToPostTest(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>Belum ada soal</h3>
          <p>Klik "Tambah Soal" atau "Import Soal" untuk mulai membuat pertanyaan.</p>
        </div>
      ) : (
        <div className={styles.questionList}>
          {questions.map((q, qIdx) => (
            <div key={q.id} className={styles.questionCard}>
              <div className={styles.questionHeader}>
                <span className={styles.qLabel}>Soal #{qIdx + 1}</span>
                <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(qIdx)}>Hapus</button>
              </div>
              <div className="form-group">
                <label className="form-label">Pertanyaan</label>
                <textarea className="form-textarea" rows={2} placeholder="Tulis pertanyaan di sini..."
                  value={q.question} onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)} />
              </div>
              <div className={styles.optionsGrid}>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className={`${styles.optionRow} ${q.correctAnswer === oIdx ? styles.correctOption : ''}`}>
                    <button
                      type="button"
                      className={styles.correctBtn}
                      onClick={() => updateQuestion(qIdx, 'correctAnswer', oIdx)}
                      title="Tandai sebagai jawaban benar"
                    >
                      {q.correctAnswer === oIdx ? '✅' : ['A', 'B', 'C', 'D'][oIdx]}
                    </button>
                    <input
                      className="form-input"
                      placeholder={`Opsi ${['A', 'B', 'C', 'D'][oIdx]}`}
                      value={opt}
                      onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Poin:</label>
                <input className="form-input" type="number" min="1" max="100" value={q.points}
                  onChange={(e) => updateQuestion(qIdx, 'points', parseInt(e.target.value) || 10)}
                  style={{ width: '80px' }} />
                
                <label className="form-label" style={{ margin: 0, marginLeft: '12px' }}>Kategori:</label>
                <select 
                  className="form-input"
                  value={q.category || 'Teori'}
                  onChange={(e) => updateQuestion(qIdx, 'category', e.target.value)}
                  style={{ width: '180px', padding: '6px' }}
                >
                  <option value="Teori">Teori</option>
                  <option value="Teknis Dasar">Teknis Dasar</option>
                  <option value="Teknis Penerapan">Teknis Penerapan</option>
                  <option value="Analisis">Analisis</option>
                  <option value="Strategi Kompleks">Strategi Kompleks</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Questions Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowImport(false)}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>📥 Import Soal Kuis</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Excel Import Card */}
              <div style={{
                background: 'rgba(79, 70, 229, 0.04)',
                border: '1px dashed var(--primary)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                <span style={{ fontSize: '2.5rem' }}>📊</span>
                <div>
                  <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Import via Excel (Rekomendasi)</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Unduh file template Excel kami, isi soal beserta pilihan ganda, lalu unggah kembali di bawah ini.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={downloadExcelTemplate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  📥 Unduh Template Excel (.xlsx)
                </button>
                <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />
                <div className="form-group" style={{ width: '100%', textAlign: 'left' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem' }}>Pilih File Excel Anda</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelUpload}
                    className="form-input"
                    style={{ padding: '8px' }}
                  />
                </div>
              </div>

              {/* Text/JSON Collapsible or Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Atau copy-paste teks</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Daftar Soal (Teks Sederhana / JSON)</label>
                <textarea 
                  className="form-textarea" 
                  rows={4} 
                  placeholder="Paste tulisan soal di sini jika tidak menggunakan Excel..."
                  value={importText} 
                  onChange={(e) => setImportText(e.target.value)} 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowImport(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!importText.trim()}>
                📥 Import Teks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
