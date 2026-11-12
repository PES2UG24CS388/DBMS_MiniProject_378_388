'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function Access() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/auth/me').then((m) => {
      setMe(m);
      if (m.roles.some((r) => ['ADMIN', 'AUDITOR'].includes(r))) api('/api/users').then((d) => setUsers(d.users)).catch(() => {});
    }).catch(() => {});
  }, []);

  async function check(e) {
    e.preventDefault(); setErr(''); setOut(null);
    const f = Object.fromEntries(new FormData(e.target));
    const qs = new URLSearchParams({ action: f.action, resource: f.resource });
    if (f.userId) qs.set('userId', f.userId);
    try { setOut(await api('/api/access/check?' + qs)); } catch (x) { setErr(x.message); }
  }

  return (
    <>
      <h1>Access check</h1>
      <p className="lead">Ask the policy engine whether a user may perform an action on a resource. Role permissions are checked first, then active policy rules can still deny. Every check is recorded in the audit trail.</p>
      <div className="card">
        <form className="row" onSubmit={check}>
          {users.length > 0 && (
            <label>User<select name="userId" defaultValue="">
              <option value="">Me ({me?.username})</option>
              {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.username} ({u.status})</option>)}
            </select></label>)}
          <label>Action<select name="action" defaultValue="READ">
            {['READ', 'CREATE', 'UPDATE', 'ASSIGN', 'ARCHIVE', 'EXPORT'].map((a) => <option key={a}>{a}</option>)}</select></label>
          <label>Resource<select name="resource" defaultValue="profile">
            {['profile', 'user', 'role', 'audit_log', 'policy', 'report', 'payroll'].map((a) => <option key={a}>{a}</option>)}</select></label>
          <button>Check access</button>
        </form>
        {err && <div className="note err" role="alert">{err}</div>}
        {out && (
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '.5rem 0' }} role="status">
            <span className={`verdict ${out.decision}`}>{out.decision}</span>
            <div><b>{out.username}</b><br />{out.reason}{out.rule_id ? ` (policy rule ${out.rule_id})` : ''}</div>
          </div>)}
      </div>
    </>
  );
}
