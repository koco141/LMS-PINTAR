'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    setMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>🎓</span>
          <span className={styles.logoText}>
            PIN<span className={styles.logoAccent}>TAR</span>
          </span>
        </Link>

        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>Beranda</Link>
          {user && !isAdmin && (
            <Link href="/dashboard" className={styles.navLink}>Dashboard Saya</Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={styles.navLink}>Panel Admin</Link>
          )}
        </div>

        <div className={styles.navRight}>
          {!user ? (
            <Link href="/login" className="btn btn-primary btn-sm">
              Masuk
            </Link>
          ) : (
            <div className={styles.userMenu}>
              <button
                className={styles.userBtn}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="User menu"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className={styles.userName}>
                  {user.displayName?.split(' ')[0] || 'User'}
                </span>
                <span className={styles.chevron}>{menuOpen ? '▲' : '▼'}</span>
              </button>

              {menuOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <p className={styles.dropdownName}>{user.displayName || 'Pengguna'}</p>
                    <p className={styles.dropdownEmail}>{user.email}</p>
                    {isAdmin && <span className="badge badge-ongoing" style={{ marginTop: '6px' }}>Admin</span>}
                  </div>
                  <div className={styles.dropdownDivider} />
                  {user && !isAdmin && (
                    <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                      📊 Dashboard Saya
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/admin" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                      ⚙️ Panel Admin
                    </Link>
                  )}
                  <div className={styles.dropdownDivider} />
                  <button onClick={handleSignOut} className={styles.dropdownItem + ' ' + styles.signOut}>
                    🚪 Keluar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
