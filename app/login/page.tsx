'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './page.module.css';

export default function LoginPage() {
  const { user, isAdmin, signInWithGoogle, signInWithEmail, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push(isAdmin ? '/admin' : '/dashboard');
    }
  }, [user, isAdmin, loading, router]);

  const handleGoogleSignIn = async () => {
    setError('');
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(`Gagal login dengan Google: ${err.message || err.code || err}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email atau password salah.');
      } else {
        setError(`Terjadi kesalahan: ${err.message || err.code || err}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <div className={styles.container}>
        <div className={styles.card}>
          {/* Logo */}
          <div className={styles.logo}>
            <span>🎓</span>
            <span className={styles.logoText}>
              PIN<span className={styles.logoAccent}>TAR</span>
            </span>
          </div>

          <h1 className={styles.title}>Selamat Datang Kembali 👋</h1>
          <p className={styles.subtitle}>Masuk untuk melanjutkan pembelajaran Anda</p>

          {/* Google Sign In Button */}
          <button
            className={styles.googleBtn}
            onClick={handleGoogleSignIn}
            disabled={authLoading}
          >
            {authLoading ? (
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
                Masuk dengan Google
              </>
            )}
          </button>

          <div className={styles.divider}>
            <span>atau masuk menggunakan email</span>
          </div>

          {/* Email Password Form */}
          <form className={styles.form} onSubmit={handleEmailSignIn}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="nama@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={authLoading}
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="password">Password</label>
              </div>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={authLoading}
              />
            </div>

            {error && (
              <div className={styles.errorAlert}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '4px' }}
              disabled={authLoading}
            >
              {authLoading ? (
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              ) : (
                'Lanjut'
              )}
            </button>
          </form>

          <div className={styles.footer}>
            <a href="/" className={styles.backLink}>← Kembali ke Beranda</a>
          </div>
        </div>
      </div>
    </div>
  );
}
