'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const NAV = [
  ['/dashboard', 'Overview', null],
  ['/access', 'Access check', null],
  ['/users', 'Users & roles', ['ADMIN', 'AUDITOR']],
  ['/audit', 'Audit trail', ['ADMIN', 'AUDITOR']],
  ['/policies', 'Policies', ['ADMIN', 'AUDITOR']]
];

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const bare = path.startsWith('/login');

  useEffect(() => {
    if (bare) return;
    api('/api/auth/me').then(setMe).catch(() => {});
  }, [bare, path]);

  if (bare) return children;

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">Access Audit Engine<small>Identity &amp; RBAC console</small></div>
        {NAV.filter(([, , roles]) => !roles || !me || roles.some((r) => me.roles.includes(r))).map(([href, label]) => (
          <Link key={href} href={href} className={path.startsWith(href) ? 'on' : ''}>{label}</Link>
        ))}
        <div className="who">
          {me ? (<><b>{me.username}</b>{me.roles.join(', ') || 'no role'}</>) : 'Loading...'}
          <div style={{ marginTop: '.6rem' }}><button className="ghost small" onClick={logout}>Sign out</button></div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
