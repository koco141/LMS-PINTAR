'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTrainingById, getTrainingEnrollments, getModules, getUserById, Training, Enrollment, deleteEnrollment, Module } from '@/lib/db';
import Link from 'next/link';
import styles from './page.module.css';

interface ParticipantRow {
  userId: string;
  name: string;
  email: string;
  photoURL: string | null;
  preTestScore: number | null;
  postTestScore: number | null;
  totalAssignmentScore: number;
  completedModules: number;
  totalModules: number;
  progress: number;
  enrolledAt: any;
  assignments?: Record<string, string>;
}

export default function ParticipantsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [training, setTraining] = useState<Training | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | null>(null);
  const [search, setSearch] = useState('');
  const [modules, setModules] = useState<Module[]>([]);

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
    setModules(modules);

    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const u: any = await getUserById(e.userId);
        
        const assignmentScores = (e as any).assignmentScores || {};
        const totalAssignmentScore = Object.values(assignmentScores).reduce((sum: number, score: any) => sum + (Number(score) || 0), 0);

        return {
          userId: e.userId,
          name: u?.fullName || u?.name || 'Anonim',
          email: u?.email || '',
          photoURL: u?.photoURL || null,
          preTestScore: e.preTestScore,
          postTestScore: e.postTestScore,
          totalAssignmentScore,
          completedModules: e.completedModules.length,
          totalModules: modules.length,
          progress: modules.length > 0 ? Math.round((e.completedModules.length / modules.length) * 100) : 0,
          enrolledAt: e.enrolledAt,
          assignments: e.assignments,
        };
      })
    );

    rows.sort((a, b) => (b.postTestScore || 0) - (a.postTestScore || 0));
    setParticipants(rows);
    setPageLoading(false);
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

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
      const data = filteredParticipants.map((p, idx) => ({
        'No': idx + 1,
        'Nama': p.name,
        'Email': p.email,
        'Pre-Test': p.preTestScore ?? 'Belum',
        'Post-Test': p.postTestScore ?? 'Belum',
        'Nilai Tugas (Total)': p.totalAssignmentScore,
        'Progress (%)': p.progress,
      }));
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

      doc.setFontSize(16);
      doc.text(`PINTAR — ${training?.title}`, 14, 16);
      doc.setFontSize(10);
      doc.text(`Daftar Peserta | Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 24);

      autoTable(doc, {
        startY: 30,
        head: [['No', 'Nama', 'Email', 'Pre-Test', 'Post-Test', 'Tugas', 'Progress']],
        body: filteredParticipants.map((p, idx) => [
          idx + 1,
          p.name,
          p.email,
          p.preTestScore ?? 'Belum',
          p.postTestScore ?? 'Belum',
          p.totalAssignmentScore,
          `${p.progress}%`,
        ]),
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

  if (pageLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  const avgPre = participants.filter((p) => p.preTestScore !== null).reduce((s, p) => s + (p.preTestScore || 0), 0) / (participants.filter((p) => p.preTestScore !== null).length || 1);
  const avgPost = participants.filter((p) => p.postTestScore !== null).reduce((s, p) => s + (p.postTestScore || 0), 0) / (participants.filter((p) => p.postTestScore !== null).length || 1);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumb}>
          <Link href="/admin">Admin</Link>
          <span>›</span>
          <Link href={`/admin/trainings/${id}`}>{training?.title}</Link>
          <span>›</span>
          <span>Peserta</span>
        </div>

        <div className={styles.pageHeader}>
          <div>
            <h1>👥 Peserta</h1>
            <p className={styles.pageSubtitle}>{training?.title}</p>
          </div>
          <div className={styles.exportBtns}>
            <button
              className="btn btn-secondary"
              onClick={handleExportExcel}
              disabled={exportLoading !== null}
            >
              {exportLoading === 'excel' ? '⏳ Exporting...' : '📊 Export Excel'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleExportPDF}
              disabled={exportLoading !== null}
            >
              {exportLoading === 'pdf' ? '⏳ Exporting...' : '📄 Export PDF'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
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

        {/* Search */}
        <div className={styles.searchBar}>
          <input
            className="form-input"
            type="text"
            placeholder="🔍 Cari nama atau email peserta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {filteredParticipants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>Belum ada peserta</h3>
            <p>Peserta akan muncul setelah mendaftar menggunakan token pelatihan.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama Peserta</th>
                  <th>Pre-Test</th>
                  <th>Post-Test</th>
                  <th>Nilai Tugas (Total)</th>
                  <th>Progress Materi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, idx) => (
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
                    <td>
                      <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                        {p.totalAssignmentScore}
                      </span>
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
                        🗑️
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
  );
}
