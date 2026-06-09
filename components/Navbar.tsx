'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './Navbar.module.css';
import { GraduationCap, LayoutDashboard, Settings, LogOut, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, userProfile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    setMenuOpen(false);
  };

  const displayName = userProfile?.fullName || userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}><GraduationCap size={22} strokeWidth={2.2} /></span>
          <span className={styles.logoText}>
            PIN<span className={styles.logoAccent}>TAR</span>
          </span>
        </Link>

        <div className={`${styles.navLinks} ${mobileNavOpen ? styles.mobileOpen : ''}`}>
          <Link href="/" className={styles.navLink} onClick={() => setMobileNavOpen(false)}>Beranda</Link>
          {user && !isAdmin && (
            <Link href="/dashboard" className={styles.navLink} onClick={() => setMobileNavOpen(false)}>Dashboard Saya</Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={styles.navLink} onClick={() => setMobileNavOpen(false)}>Panel Admin</Link>
          )}
        </div>

        <div className={styles.navRight}>
          <button 
            className={styles.hamburgerBtn}
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

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
                  <img src={user.photoURL} alt={displayName} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <span className={styles.userName}>
                  {displayName.split(' ')[0]}
                </span>
                <span className={styles.chevron}>
                  {menuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {menuOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <p className={styles.dropdownName}>{displayName}</p>
                    <p className={styles.dropdownEmail}>{user.email}</p>
                    {isAdmin && <span className="badge badge-ongoing" style={{ marginTop: '6px' }}>Admin</span>}
                  </div>
                  <div className={styles.dropdownDivider} />
                  {user && !isAdmin && (
                    <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard size={15} style={{ marginRight: '8px', opacity: 0.7 }} />
                      Dashboard Saya
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/admin" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                      <Settings size={15} style={{ marginRight: '8px', opacity: 0.7 }} />
                      Panel Admin
                    </Link>
                  )}
                  <div className={styles.dropdownDivider} />
                  <button onClick={handleSignOut} className={styles.dropdownItem + ' ' + styles.signOut}>
                    <LogOut size={15} style={{ marginRight: '8px', opacity: 0.7 }} />
                    Keluar
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
