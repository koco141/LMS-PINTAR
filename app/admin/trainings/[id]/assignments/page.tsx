'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getModules, getUserById, updateAssignmentScore, Training, Module } from '@/lib/db';
import Link from 'next/link';

interface AssignmentRow {
  userId: string;
  name: string;
  email: string;
  assignments: Record<string, string>; // moduleId -> link
  assignmentScores: Record<string, number>; // moduleId -> score
  assignmentRubrics: Record<string, Record<string, number>>; // moduleId -> { dimensionName: score }
  totalScore: number;
}

const getRubricDimensions = (level: number) => {
  if (level < 3) return []; // Single score
  if (level === 3) return [{ key: 'kualitas', label: 'Kualitas (60%)', weight: 0.6 }, { key: 'efisiensi', label: 'Efisiensi (40%)', weight: 0.4 }];
  if (level === 4) return [{ key: 'kualitas', label: 'Kualitas (40%)', weight: 0.4 }, { key: 'efisiensi', label: 'Efisiensi (30%)', weight: 0.3 }, { key: 'analisis', label: 'Analisis & Solusi (30%)', weight: 0.3 }];
  return [{ key: 'kualitas', label: 'Kualitas (40%)', weight: 0.4 }, { key: 'analisis', label: 'Analisis (30%)', weight: 0.3 }, { key: 'efisiensi', label: 'Efisiensi (20%)', weight: 0.2 }, { key: 'sikap', label: 'Transfer Knowledge (10%)', weight: 0.1 }];
};

export default function AssignmentsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [participants, setParticipants] = useState<AssignmentRow[]>([]);
  const [taskModules, setTaskModules] = useState<Module[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // State for tracking inline edits: { [userId_moduleId]: value }
  const [editingScores, setEditingScores] = useState<Record<string, string>>({});
  const [editingRubrics, setEditingRubrics] = useState<Record<string, Record<string, string>>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) { router.push('/login'); return; }
    if (!loading && user && isAdmin) loadData();
  }, [user, isAdmin, loading, id]);

  const loadData = async () => {
    const [t, enrollments, modules] = await Promise.all([
      getTrainingById(id),
      getTrainingEnrollments(id),
      getModules(id),
    ]);
    setTraining(t);
    
    const tModules = modules.filter(m => m.type === 'tugas');
    setTaskModules(tModules);

    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const u: any = await getUserById(e.userId);
        const scores = (e as any).assignmentScores || {};
        
        let total = 0;
        tModules.forEach(m => {
          total += Number(scores[m.id]) || 0;
        });

        return {
          userId: e.userId,
          name: u?.fullName || u?.name || 'Anonim',
          email: u?.email || '',
          assignments: e.assignments || {},
          assignmentScores: scores,
          assignmentRubrics: (e as any).assignmentRubrics || {},
          totalScore: total,
        };
      })
    );

    // Sort by name
    rows.sort((a, b) => a.name.localeCompare(b.name));
    setParticipants(rows);
    setPageLoading(false);
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleScoreChange = (userId: string, moduleId: string, val: string) => {
    setEditingScores(prev => ({
      ...prev,
      [`${userId}_${moduleId}`]: val
    }));
  };

  const handleRubricChange = (userId: string, moduleId: string, dimKey: string, val: string) => {
    const key = `${userId}_${moduleId}`;
    setEditingRubrics(prev => {
      const current = prev[key] || participants.find(p => p.userId === userId)?.assignmentRubrics[moduleId] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          [dimKey]: val
        }
      };
    });
  };

  const handleSaveScore = async (userId: string, moduleId: string) => {
    const key = `${userId}_${moduleId}`;
    const level = training?.targetLevel || 5;
    const dims = getRubricDimensions(level);
    
    let finalScore = 0;
    let rubricsToSave: Record<string, number> | undefined = undefined;

    if (dims.length === 0) {
      const valStr = editingScores[key];
      if (valStr === undefined) return; // No change
      finalScore = parseInt(valStr, 10);
      if (isNaN(finalScore) || finalScore < 0) finalScore = 0;
      if (finalScore > 100) finalScore = 100;
    } else {
      const rubricsStr = editingRubrics[key];
      if (!rubricsStr) return; // No change
      
      rubricsToSave = {};
      let total = 0;
      dims.forEach(d => {
        let val = parseInt(rubricsStr[d.key] || '0', 10);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 100) val = 100;
        rubricsToSave![d.key] = val;
        total += val * d.weight;
      });
      finalScore = Math.round(total);
    }

    setSavingStatus(prev => ({ ...prev, [key]: true }));
    try {
      await updateAssignmentScore(userId, id, moduleId, finalScore, rubricsToSave);
      
      // Update local state
      setParticipants(prev => prev.map(p => {
        if (p.userId === userId) {
          const newScores = { ...p.assignmentScores, [moduleId]: finalScore };
          const newRubrics = { ...p.assignmentRubrics };
          if (rubricsToSave) {
            newRubrics[moduleId] = rubricsToSave;
          }
          let newTotal = 0;
          taskModules.forEach(m => {
            newTotal += Number(newScores[m.id]) || 0;
          });
          return { ...p, assignmentScores: newScores, assignmentRubrics: newRubrics, totalScore: newTotal };
        }
        return p;
      }));
      
      // Clear editing state for this cell
      setEditingScores(prev => { const next = { ...prev }; delete next[key]; return next; });
      setEditingRubrics(prev => { const next = { ...prev }; delete next[key]; return next; });
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
        <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
          <Link href="/admin" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Admin</Link>
          <span>›</span>
          <Link href={`/admin/trainings/${id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{training?.title}</Link>
          <span>›</span>
          <span>Penilaian Tugas</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              📝 Penilaian Tugas
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{training?.title}</p>
          </div>
          <Link href={`/admin/trainings/${id}`} className="btn btn-secondary">
            ← Kembali ke Pelatihan
          </Link>
        </div>

        {taskModules.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📚</span>
            <h3>Tidak Ada Tugas</h3>
            <p style={{ color: 'var(--text-muted)' }}>Pelatihan ini tidak memiliki materi bertipe Penugasan.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="🔍 Cari nama atau email peserta..."
                className="form-input"
                style={{ maxWidth: '400px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                        <th key={m.id} style={{ padding: '16px', fontWeight: 600, minWidth: '240px' }}>
                          Tugas {i + 1}<br/>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.title}</span>
                          {m.competencyCategory && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '2px', fontWeight: 700, padding: '2px 6px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '4px', display: 'inline-block' }}>
                              Kategori: {m.competencyCategory}
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
                          const score = p.assignmentScores[m.id] ?? '';
                          const key = `${p.userId}_${m.id}`;
                          
                          const level = training?.targetLevel || 5;
                          const dims = getRubricDimensions(level);
                          
                          const isEditing = dims.length === 0 ? editingScores[key] !== undefined : editingRubrics[key] !== undefined;
                          const currentVal = isEditing && dims.length === 0 ? editingScores[key] : score;
                          const isSaving = savingStatus[key];

                          return (
                            <td key={m.id} style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {link ? (
                                  <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    🔗 Lihat Tugas {i + 1}
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum kumpul</span>
                                )}
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                  {dims.length === 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="Nilai..."
                                        value={currentVal}
                                        onChange={(e) => handleScoreChange(p.userId, m.id, e.target.value)}
                                        disabled={isSaving}
                                        style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                      />
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Rubrik Penilaian</div>
                                      {dims.map(d => {
                                        const rScore = p.assignmentRubrics[m.id]?.[d.key] ?? '';
                                        const rVal = isEditing ? (editingRubrics[key]?.[d.key] ?? rScore) : rScore;
                                        return (
                                          <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.label}</span>
                                            <input
                                              type="number" min="0" max="100" placeholder="0-100"
                                              value={rVal}
                                              onChange={(e) => handleRubricChange(p.userId, m.id, d.key, e.target.value)}
                                              disabled={isSaving}
                                              style={{ width: '60px', padding: '4px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                            />
                                          </div>
                                        );
                                      })}
                                      {score !== '' && !isEditing && (
                                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.85rem' }}>
                                          <span>Total Terbobot:</span>
                                          <span style={{ color: 'var(--primary)' }}>{score}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {isEditing && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleSaveScore(p.userId, m.id)}
                                      disabled={isSaving}
                                      style={{ padding: '6px 12px', fontSize: '0.8rem', alignSelf: 'flex-start' }}
                                    >
                                      {isSaving ? '...' : 'Simpan Nilai'}
                                    </button>
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
