'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getModules, getUserById, Training, Enrollment, deleteEnrollment, Module, getGroups, createGroup, deleteGroup, assignUserToGroup, Group } from '@/lib/db';
import Link from 'next/link';
import styles from './page.module.css';
import { Users, BarChart2, FileText, Trash2, Loader2, ArrowLeft, ClipboardList, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface ParticipantRow {
  userId: string;
  name: string;
  email: string;
  photoURL: string | null;
  preTestScore: number | null;
  postTestScore: number | null;
  totalAssignmentScore: number;
  finalScore: number;
  passed: boolean;
  completedModules: number;
  totalModules: number;
  progress: number;
  enrolledAt: any;
  assignments?: Record<string, string>;
  groupId?: string | null;
  isGroupLeader?: boolean;
}

export default function ParticipantsPage({ onReady }: { onReady?: () => void }) {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isInstructor, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | null>(null);
  const [search, setSearch] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [instructorName, setInstructorName] = useState<string>('-');
  const [activeTab, setActiveTab] = useState<'peserta' | 'kelompok'>('peserta');
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [randomGroupCount, setRandomGroupCount] = useState<number | ''>('');
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof ParticipantRow | '', direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !isInstructor))) { router.push('/login'); return; }
    if (!loading && user && (isAdmin || isInstructor)) loadData();
  }, [user, isAdmin, isInstructor, loading, id]);

  const loadData = async () => {
    const [t, enrollments, fetchedModules, fetchedGroups] = await Promise.all([
      getTrainingById(id),
      getTrainingEnrollments(id),
      getModules(id),
      getGroups(id),
    ]);

    if (t) {
      if (isInstructor && !isAdmin && t.instructorId !== user?.uid) {
        router.push('/admin');
        return;
      }
    }

    setTraining(t);
    setModules(fetchedModules);
    setGroups(fetchedGroups);

    if (t?.instructorId) {
      const inst: any = await getUserById(t.instructorId);
      if (inst) setInstructorName(inst.fullName || inst.name || '-');
    }

    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const u: any = await getUserById(e.userId);
        
        const assignmentScores = (e as any).assignmentScores || {};
        const tModules = fetchedModules.filter(m => m.type === 'tugas');
        
        let sumTask = 0;
        tModules.forEach(m => { sumTask += (Number(assignmentScores[m.id]) || 0); });
        const avgTaskScore = tModules.length > 0 ? sumTask / tModules.length : 0;
        
        const level = t?.targetLevel || 5;
        let finalScore = e.postTestScore || 0;
        
        if (tModules.length > 0) {
          if (level >= 3) {
            finalScore = Math.round((finalScore * 0.4) + (avgTaskScore * 0.6));
          } else {
            finalScore = Math.round((finalScore * 0.7) + (avgTaskScore * 0.3));
          }
        }
        
        const passed = level >= 3 ? finalScore >= 75 : finalScore >= 70;

        const validCompletedCount = (e.completedModules || []).filter((id: string) => modules.some(m => m.id === id)).length;

        return {
          userId: e.userId,
          name: u?.fullName || u?.name || 'Anonim',
          email: u?.email || '',
          photoURL: u?.photoURL || null,
          preTestScore: e.preTestScore,
          postTestScore: e.postTestScore,
          totalAssignmentScore: Math.round(avgTaskScore),
          finalScore,
          passed,
          completedModules: validCompletedCount,
          totalModules: fetchedModules.length,
          progress: fetchedModules.length > 0 ? Math.round((validCompletedCount / fetchedModules.length) * 100) : 0,
          enrolledAt: e.enrolledAt,
          assignments: e.assignments,
          groupId: e.groupId || null,
          isGroupLeader: e.isGroupLeader || false,
        };
      })
    );

    rows.sort((a, b) => (b.postTestScore || 0) - (a.postTestScore || 0));
    setParticipants(rows);
    setPageLoading(false);
    if (onReady) onReady();
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  const sortedParticipants = useMemo(() => {
    let sortableItems = [...filteredParticipants];
    if (sortConfig.key !== '' && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof ParticipantRow];
        const bValue = b[sortConfig.key as keyof ParticipantRow];
        
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredParticipants, sortConfig]);

  const requestSort = (key: keyof ParticipantRow) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
      key = '' as keyof ParticipantRow;
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof ParticipantRow }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronsUpDown size={14} style={{ marginLeft: '4px', opacity: 0.3, cursor: 'pointer', verticalAlign: 'middle', display: 'inline-block' }} />;
    }
    if (sortConfig.direction === 'asc') {
      return <ChevronUp size={14} style={{ marginLeft: '4px', cursor: 'pointer', verticalAlign: 'middle', display: 'inline-block' }} />;
    }
    if (sortConfig.direction === 'desc') {
      return <ChevronDown size={14} style={{ marginLeft: '4px', cursor: 'pointer', verticalAlign: 'middle', display: 'inline-block' }} />;
    }
    return null;
  };

  const handleDeleteParticipant = async (userId: string, name: string) => {
    if (!confirm(`Hapus peserta "${name}"? Data evaluasi dan progress mereka akan hilang.`)) return;
    try {
      await deleteEnrollment(userId, id);
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
    } catch (err: any) {
      alert(`Gagal menghapus peserta: ${err.message || err}`);
    }
  };

  const handleExportExcel = async () => {
    setExportLoading('excel');
    try {
      const XLSX = await import('xlsx');
      const data = sortedParticipants.map((p, idx) => {
        const row: any = {
          'No': idx + 1,
          'Nama': p.name,
          'Email': p.email,
          'Pre-Test': p.preTestScore ?? 'Belum',
          'Post-Test': p.postTestScore ?? 'Belum',
        };
        if (modules.some(m => m.type === 'tugas')) {
          row['Nilai Tugas'] = p.totalAssignmentScore;
        }
        row['Nilai Akhir'] = p.finalScore;
        row['Status Lulus'] = p.passed ? 'LULUS' : 'GAGAL';
        row['Progress (%)'] = p.progress;
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Peserta');
      XLSX.writeFile(wb, `PINTAR_${training?.title || 'Peserta'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert('Gagal export Excel. Coba lagi.');
    } finally {
      setExportLoading(null);
    }
  };

  const handleExportPDF = async () => {
    setExportLoading('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });

      const startDateStr = training?.startDate ? new Date((training.startDate as any).toMillis ? (training.startDate as any).toMillis() : training.startDate).toLocaleDateString('id-ID') : '-';
      const endDateStr = training?.endDate ? new Date((training.endDate as any).toMillis ? (training.endDate as any).toMillis() : training.endDate).toLocaleDateString('id-ID') : '-';
      const locationStr = training?.method === 'daring' ? 'Daring (Online)' : training?.city ? `${training?.city}, ${training?.province}` : '-';

      doc.setFontSize(16);
      doc.text(`PINTAR — ${training?.title}`, 14, 16);
      doc.setFontSize(10);
      doc.text(`Instruktur: ${instructorName} | Lokasi: ${locationStr}`, 14, 22);
      doc.text(`Pelaksanaan: ${startDateStr} - ${endDateStr} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

      const exportHasTugas = modules.some(m => m.type === 'tugas');
      const headRow = exportHasTugas
        ? ['No', 'Nama', 'Email', 'Pre-Test', 'Post-Test', 'Tugas', 'Akhir', 'Status']
        : ['No', 'Nama', 'Email', 'Pre-Test', 'Post-Test', 'Akhir', 'Status'];

      autoTable(doc, {
        startY: 34,
        head: [headRow],
        body: sortedParticipants.map((p, idx) => {
          const row: any[] = [
            idx + 1,
            p.name,
            p.email,
            p.preTestScore ?? 'Belum',
            p.postTestScore ?? 'Belum',
          ];
          if (exportHasTugas) row.push(p.totalAssignmentScore);
          row.push(p.finalScore, p.passed ? 'LULUS' : 'GAGAL');
          return row;
        }),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 250] },
      });

      doc.save(`PINTAR_${training?.title || 'Peserta'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      alert('Gagal export PDF. Coba lagi.');
    } finally {
      setExportLoading(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup(id, newGroupName.trim());
      setNewGroupName('');
      loadData();
    } catch (err) {
      alert('Gagal membuat grup');
    }
  };

  const handleGenerateRandomGroups = async () => {
    if (!randomGroupCount || randomGroupCount <= 0) return;
    if (!confirm(`Sistem akan membuat ${randomGroupCount} grup dan membagi otomatis seluruh peserta. Lanjutkan?`)) return;
    
    try {
      setPageLoading(true);
      // Delete existing groups first (optional, but requested for clean slate usually)
      for (const g of groups) {
        await deleteGroup(id, g.id);
      }
      
      // Create N groups
      const newGroupIds: string[] = [];
      for (let i = 1; i <= randomGroupCount; i++) {
        const gid = await createGroup(id, `Kelompok ${i}`);
        newGroupIds.push(gid);
      }
      
      // Shuffle participants
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      
      // Assign participants evenly
      const promises = [];
      for (let i = 0; i < shuffled.length; i++) {
        const participant = shuffled[i];
        const groupIndex = i % newGroupIds.length;
        const targetGroupId = newGroupIds[groupIndex];
        // The first person assigned to a group becomes leader
        const isFirstInGroup = i < newGroupIds.length;
        promises.push(assignUserToGroup(participant.userId, id, targetGroupId, isFirstInGroup));
      }
      
      await Promise.all(promises);
      await loadData();
      alert('Berhasil membagi peserta secara acak!');
    } catch (err) {
      alert('Gagal membagi grup secara acak.');
      setPageLoading(false);
    }
  };

  const handleChangeGroup = async (userId: string, targetGroupId: string | null) => {
    try {
      // Find if target group has a leader, if not, make this person leader
      let isLeader = false;
      if (targetGroupId) {
        const currentMembers = participants.filter(p => p.groupId === targetGroupId && p.userId !== userId);
        const hasLeader = currentMembers.some(p => p.isGroupLeader);
        if (!hasLeader) isLeader = true;
      }
      
      await assignUserToGroup(userId, id, targetGroupId, isLeader);
      await loadData();
    } catch (err) {
      alert('Gagal memindahkan peserta.');
    }
  };

  const handleSetLeader = async (userId: string, groupId: string) => {
    try {
      // Find current leader of the group and remove leader status
      const currentMembers = participants.filter(p => p.groupId === groupId);
      const promises = currentMembers.map(p => {
        if (p.userId === userId) {
          return assignUserToGroup(p.userId, id, groupId, true);
        } else if (p.isGroupLeader) {
          return assignUserToGroup(p.userId, id, groupId, false);
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      await loadData();
    } catch (err) {
      alert('Gagal menetapkan ketua.');
    }
  };

  if (pageLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  const hasTugas = modules.some(m => m.type === 'tugas');

  const avgPre = participants.filter((p) => p.preTestScore !== null).reduce((s, p) => s + (p.preTestScore || 0), 0) / (participants.filter((p) => p.preTestScore !== null).length || 1);
  const avgPost = participants.filter((p) => p.postTestScore !== null).reduce((s, p) => s + (p.postTestScore || 0), 0) / (participants.filter((p) => p.postTestScore !== null).length || 1);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={`${styles.breadcrumb} print-hidden`}>
          <Link href="/admin">{isAdmin ? 'Panel Admin' : 'Panel Pengajar'}</Link>
          <span>›</span>
          <span>{training?.title}</span>
          <span>›</span>
          <span>Peserta</span>
        </div>

        <div className="print-only" style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Daftar Peserta — {training?.title}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Instruktur: {instructorName} | Lokasi: {training?.method === 'daring' ? 'Daring (Online)' : training?.city ? `${training?.city}, ${training?.province}` : '-'}
          </p>
        </div>

        <div className={`${styles.pageHeader} print-hidden`}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
              Peserta
            </h1>
            <p className={styles.pageSubtitle}>{training?.title}</p>
          </div>
          <div className={`${styles.exportBtns} print-hidden`}>
            {hasTugas && (
              <Link href={`/admin/trainings/${id}/assignments`} className="btn btn-secondary">
                <ClipboardList size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Nilai Tugas
              </Link>
            )}
            <Link href={`/admin/trainings/${id}/analytics`} className="btn btn-secondary">
              <BarChart2 size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Analisis
            </Link>
            <button
              className="btn btn-secondary"
              onClick={handleExportExcel}
              disabled={exportLoading !== null}
            >
              {exportLoading === 'excel'
                ? <><Loader2 size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} className="spin" />Exporting...</>
                : <><BarChart2 size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Export Excel</>
              }
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleExportPDF}
              disabled={exportLoading !== null}
            >
              {exportLoading === 'pdf'
                ? <><Loader2 size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} className="spin" />Exporting...</>
                : <><FileText size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Export PDF</>
              }
            </button>
            <Link href="/admin" className="btn btn-secondary">
              <ArrowLeft size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Kembali
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4 print-hidden" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <span className="stat-label">Total Peserta</span>
            <span className="stat-value">{participants.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Sudah Post-Test</span>
            <span className="stat-value" style={{ color: 'var(--status-ongoing)' }}>
              {participants.filter((p) => p.postTestScore !== null).length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Rata-rata Pre-Test</span>
            <span className="stat-value" style={{ color: 'var(--status-upcoming)' }}>
              {participants.filter((p) => p.preTestScore !== null).length > 0 ? Math.round(avgPre) : '—'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Rata-rata Post-Test</span>
            <span className="stat-value" style={{ color: 'var(--primary-light)' }}>
              {participants.filter((p) => p.postTestScore !== null).length > 0 ? Math.round(avgPost) : '—'}
            </span>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className={`${styles.searchBar} print-hidden`}>
          <input
            className="form-input"
            type="text"
            placeholder="Cari nama atau email peserta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: '16px' }}
          />
        </div>

        {training?.learningModel === 'GROUP' && (
          <div className="print-hidden" style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <button
              style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'peserta' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'peserta' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'peserta' ? 600 : 400, cursor: 'pointer' }}
              onClick={() => setActiveTab('peserta')}
            >
              Daftar Peserta
            </button>
            <button
              style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'kelompok' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'kelompok' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'kelompok' ? 600 : 400, cursor: 'pointer' }}
              onClick={() => setActiveTab('kelompok')}
            >
              Manajemen Kelompok
            </button>
          </div>
        )}

        {/* Tab Kelompok */}
        {activeTab === 'kelompok' && (
          <div className="print-hidden">
            {training?.groupSelectionType === 'RANDOM' && (
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Generate Kelompok Acak</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Jumlah kelompok..." 
                    value={randomGroupCount}
                    onChange={(e) => setRandomGroupCount(parseInt(e.target.value))}
                    style={{ maxWidth: '200px' }}
                  />
                  <button className="btn btn-primary" onClick={handleGenerateRandomGroups}>Generate & Bagi Rata</button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Peringatan: Fitur ini akan menghapus semua kelompok dan penempatan peserta sebelumnya, lalu membaginya ulang.</p>
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Tambah Kelompok Manual</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Nama kelompok baru..." 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={{ maxWidth: '300px' }}
                />
                <button className="btn btn-secondary" onClick={handleCreateGroup}>Tambah</button>
              </div>
            </div>

            <div className="grid-2" style={{ gap: '20px' }}>
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Peserta Belum Berkelompok</span>
                  <span className="badge">{participants.filter(p => !p.groupId).length}</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {participants.filter(p => !p.groupId).map(p => (
                    <div key={p.userId} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{p.name}</span>
                      <select 
                        className="form-input" 
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
                        onChange={(e) => handleChangeGroup(p.userId, e.target.value)}
                        value=""
                      >
                        <option value="" disabled>Pilih Grup...</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  ))}
                  {participants.filter(p => !p.groupId).length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.9rem' }}>Semua peserta sudah memiliki kelompok.</div>
                  )}
                </div>
              </div>

              {groups.map(g => {
                const groupMembers = participants.filter(p => p.groupId === g.id);
                return (
                  <div key={g.id} style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{g.name} <span className="badge" style={{ marginLeft: '8px' }}>{groupMembers.length} Peserta</span></span>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={async () => {
                        if (confirm(`Hapus kelompok ${g.name}? Peserta di dalamnya akan menjadi tanpa kelompok.`)) {
                          await deleteGroup(id, g.id);
                          // Also remove groupId from all members of this group
                          const promises = groupMembers.map(p => assignUserToGroup(p.userId, id, null, false));
                          await Promise.all(promises);
                          loadData();
                        }
                      }}>✕</button>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                      {groupMembers.map(p => (
                        <div key={p.userId} style={{ padding: '10px', background: p.isGroupLeader ? '#eff6ff' : '#f8fafc', borderRadius: '8px', border: p.isGroupLeader ? '1px solid #bfdbfe' : '1px solid transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: p.isGroupLeader ? 600 : 500, color: p.isGroupLeader ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name} {p.isGroupLeader && '👑'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {!p.isGroupLeader && (
                                <a href="#" onClick={(e) => { e.preventDefault(); handleSetLeader(p.userId, g.id); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>Jadikan Ketua</a>
                              )}
                            </div>
                          </div>
                          <select 
                            className="form-input" 
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', minHeight: 'auto', maxWidth: '100px' }}
                            onChange={(e) => handleChangeGroup(p.userId, e.target.value === 'null' ? null : e.target.value)}
                            value={g.id}
                          >
                            <option value="null">- Keluarkan -</option>
                            {groups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                          </select>
                        </div>
                      ))}
                      {groupMembers.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.9rem' }}>Belum ada peserta di kelompok ini.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Table Tab */}
        {activeTab === 'peserta' && (
          <>
            {sortedParticipants.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Users size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} /></div>
                <h3>Belum ada peserta</h3>
                <p>Peserta akan muncul setelah mendaftar menggunakan token pelatihan.</p>
              </div>
            ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th onClick={() => requestSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>Nama Peserta <SortIcon columnKey="name" /></div>
                  </th>
                  <th onClick={() => requestSort('preTestScore')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>Pre-Test <SortIcon columnKey="preTestScore" /></div>
                  </th>
                  <th onClick={() => requestSort('postTestScore')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>Post-Test <SortIcon columnKey="postTestScore" /></div>
                  </th>
                  {hasTugas && (
                    <th onClick={() => requestSort('totalAssignmentScore')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>Nilai Tugas <SortIcon columnKey="totalAssignmentScore" /></div>
                    </th>
                  )}
                  <th onClick={() => requestSort('finalScore')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>Nilai Akhir <SortIcon columnKey="finalScore" /></div>
                  </th>
                  <th onClick={() => requestSort('passed')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>Status <SortIcon columnKey="passed" /></div>
                  </th>
                  <th onClick={() => requestSort('progress')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>Progress Materi <SortIcon columnKey="progress" /></div>
                  </th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((p, idx) => (
                  <tr key={p.userId}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className={styles.participantCell}>
                        {p.photoURL ? (
                          <img src={p.photoURL} alt="" className={styles.avatar} />
                        ) : (
                          <div className={styles.avatarFallback}>{p.name[0]}</div>
                        )}
                        <div>
                          <div className={styles.participantName}>{p.name}</div>
                          <div className={styles.participantEmail}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--status-upcoming)', fontWeight: '700' }}>
                        {p.preTestScore !== null ? `${p.preTestScore}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--status-ongoing)', fontWeight: '700' }}>
                        {p.postTestScore !== null ? `${p.postTestScore}` : '—'}
                      </span>
                    </td>
                    {hasTugas && (
                      <td>
                        <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                          {p.totalAssignmentScore}
                        </span>
                      </td>
                    )}
                    <td>
                      <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                        {p.finalScore}
                      </span>
                    </td>
                    <td>
                      {p.passed ? (
                        <span style={{ color: '#16a34a', fontWeight: '700', padding: '4px 8px', background: '#dcfce7', borderRadius: '4px', fontSize: '0.8rem' }}>LULUS</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: '700', padding: '4px 8px', background: '#fee2e2', borderRadius: '4px', fontSize: '0.8rem' }}>BELUM LULUS</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.progressCell}>
                        <div className="progress-bar" style={{ width: '80px' }}>
                          <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span>{p.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-icon btn-danger btn-sm"
                        onClick={() => handleDeleteParticipant(p.userId, p.name)}
                        title="Hapus Peserta"
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
