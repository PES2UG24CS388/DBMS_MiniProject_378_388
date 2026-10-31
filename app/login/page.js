'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const f = new FormData(e.target);
    try {
      await api('/api/auth/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
      router.push('/dashboard');
    } catch (x) { setErr(x.message); setBusy(false); }
  }

  return (
    <div className="login">
      <div className="card">
        <h1>Sign in</h1>
        <p className="lead">Every sign-in attempt, successful or not, is written to the audit trail.</p>
        {err && <div className="note err" role="alert">{err}</div>}
        <form onSubmit={submit}>
          <label>Username<input name="username" autoComplete="username" required autoFocus /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
