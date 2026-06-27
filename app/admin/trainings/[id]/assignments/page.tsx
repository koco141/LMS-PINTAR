'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getModules, getUserById, updateAssignmentScore, Training, Module } from '@/lib/db';
import Link from 'next/link';
import { ClipboardEdit, BookOpen, ExternalLink, Users, BarChart2, ArrowLeft, FileText, X } from 'lucide-react';

interface AssignmentRow {
  userId: string;
  name: string;
  email: string;
  assignments: Record<string, string>; // moduleId -> link
  assignmentTexts: Record<string, string>; // moduleId -> text
  assignmentScores: Record<string, number>; // moduleId -> score
  assignmentRubrics: Record<string, Record<string, number>>; // moduleId -> { dimensionName: score }
  totalScore: number;
  groupId?: string | null;
  isGroupLeader?: boolean;
}

const getTaskWeight = (category?: string) => {
  switch (category) {
    case 'Proyek Implementasi Teknis': return 1;
    case 'Analisis Data & Laporan': return 2;
    case 'Penyelesaian Studi Kasus': return 3;
    case 'Troubleshooting & Modifikasi': return 4;
    case 'Mentoring / Presentasi Ahli': return 5;
    default: return 1;
  }
};

export default function AssignmentsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isInstructor, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [participants, setParticipants] = useState<AssignmentRow[]>([]);
  const [taskModules, setTaskModules] = useState<Module[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // State for tracking inline edits: { [userId_moduleId]: value }
  const [editingScores, setEditingScores] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !isInstructor))) { router.push('/login'); return; }
    if (!loading && user && (isAdmin || isInstructor)) loadData();
  }, [user, isAdmin, isInstructor, loading, id]);

  const loadData = async () => {
    const [t, enrollments, modules] = await Promise.all([
      getTrainingById(id),
      getTrainingEnrollments(id),
      getModules(id),
    ]);

    if (t) {
      if (isInstructor && !isAdmin && t.instructorId !== user?.uid) {
        router.push('/admin');
        return;
      }
    }

    setTraining(t);
    
    const tModules = modules.filter(m => m.type === 'tugas');
    setTaskModules(tModules);

    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const u: any = await getUserById(e.userId);
        const scores = (e as any).assignmentScores || {};
        
        let sumProduct = 0;
        let sumWeight = 0;
        tModules.forEach(m => {
          const score = Number(scores[m.id]) || 0;
          const weight = getTaskWeight(m.competencyCategory);
          sumProduct += score * weight;
          sumWeight += weight;
        });
        const total = sumWeight > 0 ? Math.round(sumProduct / sumWeight) : 0;

        return {
          userId: e.userId,
          name: u?.fullName || u?.name || 'Anonim',
          email: u?.email || '',
          assignments: e.assignments || {},
          assignmentTexts: (e as any).assignmentTexts || {},
          assignmentScores: scores,
          assignmentRubrics: (e as any).assignmentRubrics || {},
          totalScore: total,
          groupId: e.groupId || null,
          isGroupLeader: e.isGroupLeader || false,
        };
      })
    );

    // Sort by name
    rows.sort((a, b) => a.name.localeCompare(b.name));
    setParticipants(rows);
    setPageLoading(false);
  };

  const filteredParticipants = participants.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    
    if (filterStatus === 'all') return true;

    const submittedCount = taskModules.filter(m => p.assignments[m.id] || p.assignmentTexts[m.id]).length;
    const gradedCount = taskModules.filter(m => p.assignmentScores[m.id] !== undefined && p.assignmentScores[m.id] > 0).length;

    if (filterStatus === 'complete') {
      return submittedCount === taskModules.length && taskModules.length > 0;
    }
    if (filterStatus === 'incomplete') {
      return submittedCount < taskModules.length;
    }
    if (filterStatus === 'ungraded') {
      return submittedCount > 0 && gradedCount < submittedCount;
    }
    if (filterStatus === 'graded') {
      return submittedCount > 0 && gradedCount === submittedCount;
    }

    return true;
  });

  const handleScoreChange = (userId: string, moduleId: string, val: string) => {
    setEditingScores(prev => ({
      ...prev,
      [`${userId}_${moduleId}`]: val
    }));
  };

  const handleSaveScore = async (userId: string, moduleId: string) => {
    const key = `${userId}_${moduleId}`;
    
    let finalScore = 0;

    const valStr = editingScores[key];
    if (valStr === undefined) return; // No change
    finalScore = parseInt(valStr, 10);
    if (isNaN(finalScore) || finalScore < 0) finalScore = 0;
    if (finalScore > 100) finalScore = 100;

    setSavingStatus(prev => ({ ...prev, [key]: true }));
    try {
      const module = taskModules.find(m => m.id === moduleId);
      const isGroupTask = training?.learningModel === 'GROUP' && module?.isGroupAssignment;
      
      const participant = participants.find(p => p.userId === userId);
      const groupId = participant?.groupId;

      const userIdsToUpdate = isGroupTask && groupId 
        ? participants.filter(p => p.groupId === groupId).map(p => p.userId)
        : [userId];

      const promises = userIdsToUpdate.map(uid => updateAssignmentScore(uid, id, moduleId, finalScore, undefined));
      await Promise.all(promises);
      
      // Update local state
      setParticipants(prev => prev.map(p => {
        if (userIdsToUpdate.includes(p.userId)) {
          const newScores = { ...p.assignmentScores, [moduleId]: finalScore };
          let sumProduct = 0;
          let sumWeight = 0;
          taskModules.forEach(m => {
            const score = Number(newScores[m.id]) || 0;
            const weight = getTaskWeight(m.competencyCategory);
            sumProduct += score * weight;
            sumWeight += weight;
          });
          const newTotal = sumWeight > 0 ? Math.round(sumProduct / sumWeight) : 0;
          return { ...p, assignmentScores: newScores, totalScore: newTotal };
        }
        return p;
      }));
      
      // Clear editing state for this cell
      setEditingScores(prev => { const next = { ...prev }; delete next[key]; return next; });
    } catch (err: any) {
      alert(`Gagal menyimpan nilai: ${err.message || err}`);
    } finally {
      setSavingStatus(prev => ({ ...prev, [key]: false }));
    }
  };

  if (pageLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', paddingBottom: '40px' }}>
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          <Link href="/admin" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{isAdmin ? 'Panel Admin' : 'Panel Pengajar'}</Link>
          <span>›</span>
          <span>{training?.title}</span>
          <span>›</span>
          <span>Penilaian Tugas</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ClipboardEdit size={22} style={{ color: 'var(--text-muted)' }} />
              Penilaian Tugas
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{training?.title}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href={`/admin/trainings/${id}/participants`} className="btn btn-secondary">
              <Users size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Lihat Peserta
            </Link>
            <Link href={`/admin/trainings/${id}/analytics`} className="btn btn-secondary">
              <BarChart2 size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Analisis
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              <ArrowLeft size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Kembali
            </Link>
          </div>
        </div>

        {taskModules.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <BookOpen size={48} strokeWidth={1.2} style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '16px' }} />
            <h3>Tidak Ada Tugas</h3>
            <p style={{ color: 'var(--text-muted)' }}>Pelatihan ini tidak memiliki materi bertipe Penugasan.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Cari nama atau email peserta..."
                className="form-input"
                style={{ maxWidth: '400px', flex: 1, minWidth: '250px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '200px' }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Semua Status Kumpul</option>
                <option value="complete">Sudah Kumpul Semua</option>
                <option value="incomplete">Belum Lengkap</option>
                <option value="ungraded">Perlu Dinilai</option>
                <option value="graded">Selesai Dinilai</option>
              </select>
            </div>

            {filteredParticipants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Belum ada peserta atau pencarian tidak ditemukan.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '16px', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '16px', fontWeight: 600, minWidth: '200px' }}>Nama Peserta</th>
                      {taskModules.map((m, i) => (
                        <th key={m.id} style={{ padding: '16px', fontWeight: 600, minWidth: '250px' }}>
                          <div style={{ marginBottom: '4px' }}>Tugas {i + 1}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{m.title}</div>
                          {m.competencyCategory && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, padding: '4px 8px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '4px', display: 'inline-block' }}>
                              Kategori: {m.competencyCategory}
                            </div>
                          )}
                          {m.isGroupAssignment && training?.learningModel === 'GROUP' && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--status-ongoing)', fontWeight: 700, padding: '4px 8px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px', display: 'inline-block', marginLeft: '4px' }}>
                              👥 Tugas Kelompok
                            </div>
                          )}
                        </th>
                      ))}
                      <th style={{ padding: '16px', fontWeight: 600 }}>Total Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p, idx) => (
                      <tr key={p.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.email}</div>
                        </td>
                        {taskModules.map((m, i) => {
                          const link = p.assignments[m.id];
                          const text = p.assignmentTexts[m.id];
                          const score = p.assignmentScores[m.id] ?? '';
                          const key = `${p.userId}_${m.id}`;
                          
                          const isEditing = editingScores[key] !== undefined;
                          const currentVal = isEditing ? editingScores[key] : score;
                          const isSaving = savingStatus[key];

                          return (
                            <td key={m.id} style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {link && m.submissionType !== 'text' ? (
                                  <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '250px' }}>
                                    <ExternalLink size={13} style={{ marginRight: '5px', verticalAlign: 'middle', flexShrink: 0 }} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lihat {m.title}</span>
                                  </a>
                                ) : null}
                                
                                {text && m.submissionType !== 'link' ? (
                                  <div style={{
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    background: 'var(--bg-secondary)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.85rem',
                                    whiteSpace: 'pre-wrap',
                                    color: 'var(--text-primary)'
                                  }}>
                                    {text}
                                  </div>
                                ) : null}

                                {!link && !text && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum kumpul</span>
                                )}

                                {m.isGroupAssignment && training?.learningModel === 'GROUP' && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {p.isGroupLeader ? '👑 Ketua (Penyetor)' : 'Anggota (Nilai mengikuti ketua)'}
                                  </div>
                                )}
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      placeholder="Nilai..."
                                      value={currentVal}
                                      onChange={(e) => handleScoreChange(p.userId, m.id, e.target.value)}
                                      disabled={isSaving || (m.isGroupAssignment && training?.learningModel === 'GROUP' && !p.isGroupLeader)}
                                      style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                    />
                                    {m.isGroupAssignment && training?.learningModel === 'GROUP' && !p.isGroupLeader && (
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Otomatis dari ketua</span>
                                    )}
                                  </div>
                                  
                                  {isEditing && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button 
                                        onClick={() => handleSaveScore(p.userId, m.id)}
                                        disabled={isSaving}
                                        className="btn btn-primary" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                                      >
                                        {isSaving ? '⏳' : 'Simpan'}
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setEditingScores(prev => { const next = { ...prev }; delete next[key]; return next; });
                                        }}
                                        disabled={isSaving}
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                            {p.totalScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
