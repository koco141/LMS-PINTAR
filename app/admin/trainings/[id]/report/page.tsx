'use client';

import { use, useEffect, useState } from 'react';
import AnalyticsPage from '../analytics/page';
import ParticipantsPage from '../participants/page';
import TestimonialsPage from '../testimonials/page';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [participantsReady, setParticipantsReady] = useState(false);
  const [testimonialsReady, setTestimonialsReady] = useState(false);

  const isReady = analyticsReady && participantsReady && testimonialsReady;

  useEffect(() => {
    if (isReady) {
      // Small delay to ensure rendering is fully complete
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  return (
    <div className="full-report-print">
      <div className="print-hidden" style={{ padding: '20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Mode Cetak Laporan Lengkap</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {isReady ? 'Siap dicetak!' : 'Menyiapkan data laporan...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!isReady}>
            <Printer size={16} /> Cetak Sekarang
          </button>
          <button className="btn btn-secondary" onClick={() => window.close()}>
            <ArrowLeft size={16} /> Tutup
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {!isReady && (
          <div className="print-hidden" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        )}
        <div className="report-section">
          <AnalyticsPage params={params} onReady={() => setAnalyticsReady(true)} />
        </div>
        <div className="report-section" style={{ pageBreakBefore: 'always' }}>
          <ParticipantsPage onReady={() => setParticipantsReady(true)} />
        </div>
        <div className="report-section" style={{ pageBreakBefore: 'always' }}>
          <TestimonialsPage params={params} onReady={() => setTestimonialsReady(true)} />
        </div>
      </div>
    </div>
  );
}
