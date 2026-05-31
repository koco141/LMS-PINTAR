'use client';

import { useState } from 'react';
import { Module } from '@/lib/db';
import styles from './ModuleViewer.module.css';

interface Props {
  module: Module;
  isCompleted: boolean;
  onComplete: () => void;
}

export default function ModuleViewer({ module, isCompleted, onComplete }: Props) {
  const [completing, setCompleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Convert Google Slides publish URL to embed URL if needed
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    
    // Clean up if the user accidentally pasted the whole <iframe> embed code!
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('<iframe')) {
      const matchSrc = cleanUrl.match(/src="([^"]+)"/);
      if (matchSrc) {
        cleanUrl = matchSrc[1];
      }
    }

    // If it contains /d/e/ (which is the published to web format)
    if (cleanUrl.includes('docs.google.com/presentation')) {
      if (cleanUrl.includes('/d/e/')) {
        // Change '/pub' to '/embed' for a better embedded viewing experience
        return cleanUrl.replace(/\/pub(\?|$)/, '/embed$1');
      }
      
      // If it's already an embed URL, return as is
      if (cleanUrl.includes('/embed') || cleanUrl.includes('embedded=true')) {
        return cleanUrl;
      }
      
      // Extract the presentation ID for editable presentations
      const match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=5000`;
      }
    }
    return cleanUrl;
  };

  const handleComplete = async () => {
    setCompleting(true);
    await onComplete();
    setCompleting(false);
    setConfirmed(true);
  };

  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.moduleTag}>📖 Materi</div>
          <h1 className={styles.title}>{module.title}</h1>
          {module.description && (
            <p className={styles.description}>{module.description}</p>
          )}
        </div>
        {isCompleted && (
          <div className={styles.completedBadge}>✅ Selesai</div>
        )}
      </div>

      {/* Google Slides Embed */}
      <div className={styles.slideContainer}>
        <iframe
          src={getEmbedUrl(module.embedUrl)}
          className={styles.slideFrame}
          frameBorder="0"
          allowFullScreen
          allow="autoplay"
          title={module.title}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {!isCompleted && !confirmed ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleComplete}
            disabled={completing}
          >
            {completing ? (
              <>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                Menyimpan...
              </>
            ) : (
              '✅ Tandai Selesai & Lanjut'
            )}
          </button>
        ) : (
          <div className={styles.doneMessage}>
            <span>🎉</span>
            <span>Modul ini sudah selesai! Pilih modul berikutnya dari menu samping.</span>
          </div>
        )}
      </div>
    </div>
  );
}
