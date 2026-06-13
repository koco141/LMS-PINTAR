'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createTraining, updateTraining, deleteTraining } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import styles from './page.module.css';
import { Circle, Trash2, MapPin } from 'lucide-react';

const DEFAULT_COVER = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';

export default function NewTrainingPage() {
  const { user, isAdmin, isInstructor, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed',
    coverColor: DEFAULT_COVER,
    startDate: '',
    endDate: '',
    showLeaderboard: false,
    targetLevel: 5,
    province: '',
    city: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Location states
  const [provinces, setProvinces] = useState<{id: string, name: string}[]>([]);
  const [cities, setCities] = useState<{id: string, name: string}[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // Fetch provinces
  useEffect(() => {
    const fetchProvinces = async () => {
      setLoadingProvinces(true);
      try {
        const res = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
        const data = await res.json();
        setProvinces(data);
      } catch (err) {
        console.error('Failed to fetch provinces', err);
      } finally {
        setLoadingProvinces(false);
      }
    };
    fetchProvinces();
  }, []);

  // Fetch cities when province changes
  useEffect(() => {
    if (!selectedProvinceId) {
      setCities([]);
      return;
    }
    const fetchCities = async () => {
      setLoadingCities(true);
      try {
        const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${selectedProvinceId}.json`);
        const data = await res.json();
        setCities(data);
      } catch (err) {
        console.error('Failed to fetch cities', err);
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, [selectedProvinceId]);

  const calculateStatus = (startStr: string, endStr: string): 'upcoming' | 'ongoing' | 'completed' => {
    if (!startStr) return 'ongoing';
    const now = new Date();
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;

    if (now < start) return 'upcoming';
    if (end && now > end) return 'completed';
    return 'ongoing';
  };

  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !isInstructor))) router.push('/login');
  }, [user, isAdmin, isInstructor, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Nama pelatihan wajib diisi.'); return; }
    setSaving(true);
    setError('');
    try {
      const computedStatus = calculateStatus(form.startDate, form.endDate);
      const { id, token } = await createTraining({
        title: form.title.trim(),
        description: form.description.trim(),
        status: computedStatus,
        coverColor: form.coverColor,
        startDate: form.startDate ? Timestamp.fromDate(new Date(form.startDate)) : null,
        endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : null,
        showLeaderboard: form.showLeaderboard,
        targetLevel: form.targetLevel,
        province: form.province,
        city: form.city,
      });
      router.push(`/admin/trainings/${id}`);
    } catch (err: any) {
      console.error("Gagal menyimpan pelatihan:", err);
      setError(`Gagal menyimpan pelatihan: ${err.message || err.code || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link href="/admin">{isAdmin ? 'Panel Admin' : 'Panel Pengajar'}</Link>
          <span>›</span>
          <span>Pelatihan Baru</span>
        </div>

        <h1 className={styles.title}>Buat Pelatihan Baru</h1>
        <p className={styles.subtitle}>
          Token akan digenerate otomatis setelah pelatihan disimpan.
        </p>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nama Pelatihan *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Contoh: Pelatihan Kepemimpinan Tingkat Dasar"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Deskripsi</label>
            <textarea
              className="form-textarea"
              placeholder="Deskripsikan pelatihan ini..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Level Kompetensi Pelatihan</label>
            <select
              className="form-input"
              value={form.targetLevel}
              onChange={(e) => setForm({ ...form, targetLevel: Number(e.target.value) })}
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

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <MapPin size={18} style={{ color: 'var(--primary-light)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Lokasi Pelatihan (Indonesia)</h3>
            </div>
            
            <div className={styles.row} style={{ gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Provinsi</label>
                <select
                  className="form-input"
                  value={selectedProvinceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedProvinceId(id);
                    const selectedProv = provinces.find(p => p.id === id);
                    setForm({ ...form, province: selectedProv ? selectedProv.name : '', city: '' });
                  }}
                  disabled={loadingProvinces}
                >
                  <option value="">{loadingProvinces ? 'Memuat Provinsi...' : '-- Pilih Provinsi --'}</option>
                  {provinces.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Kabupaten / Kota</label>
                <select
                  className="form-input"
                  value={form.city ? cities.find(c => c.name === form.city)?.id || '' : ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const selectedCity = cities.find(c => c.id === id);
                    setForm({ ...form, city: selectedCity ? selectedCity.name : '' });
                  }}
                  disabled={!selectedProvinceId || loadingCities}
                >
                  <option value="">
                    {!selectedProvinceId ? '-- Pilih Provinsi Terlebih Dahulu --' : loadingCities ? 'Memuat Kota...' : '-- Pilih Kota --'}
                  </option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.row}>
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
                <Circle size={8} fill="currentColor" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {form.status === 'ongoing' ? 'Berlangsung' : form.status === 'upcoming' ? 'Akan Datang' : 'Selesai'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal & Jam Mulai</label>
              <input
                className="form-input"
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => {
                  const start = e.target.value;
                  setForm({ ...form, startDate: start, status: calculateStatus(start, form.endDate) });
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal & Jam Selesai</label>
              <input
                className="form-input"
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => {
                  const end = e.target.value;
                  setForm({ ...form, endDate: end, status: calculateStatus(form.startDate, end) });
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Gambar Cover (Maksimal 1 MB)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {form.coverColor && (form.coverColor.startsWith('data:') || form.coverColor.startsWith('http') || !form.coverColor.includes('gradient')) ? (
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '160px',
                  borderRadius: '8px',
                  backgroundImage: `url(${form.coverColor})`,
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
                    onClick={() => setForm({ ...form, coverColor: DEFAULT_COVER })}
                  >
                    <Trash2 size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                    Hapus Gambar
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
                    setForm({ ...form, coverColor: base64 });
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
              <p className={styles.toggleHint}>Jika aktif, peserta dapat melihat peringkat</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={form.showLeaderboard}
                onChange={(e) => setForm({ ...form, showLeaderboard: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.875rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div className={styles.formActions}>
            <Link href="/admin" className="btn btn-secondary">Batal</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Menyimpan...</> : 'Simpan & Lanjut ke Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
