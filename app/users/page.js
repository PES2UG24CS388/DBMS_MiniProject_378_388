'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export default function Users() {
  const [d, setD] = useState({ users: [], orgs: [], depts: [] });
  const [roles, setRoles] = useState([]);
  const [me, setMe] = useState(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState(null);
  const [orgId, setOrgId] = useState('');

  const load = useCallback(async (search = '') => {
    try {
      const [u, r] = await Promise.all([api('/api/users?q=' + encodeURIComponent(search)), api('/api/roles')]);
      setD(u); setRoles(r.roles);
    } catch (e) { setMsg({ err: e.message }); }
  }, []);

  useEffect(() => { api('/api/auth/me').then(setMe).catch(() => {}); load(); }, [load]);
  const isAdmin = me?.roles.includes('ADMIN');

  async function run(fn, okText) {
    setMsg(null);
    try { await fn(); setMsg({ ok: okText }); await load(q); } catch (e) { setMsg({ err: e.message }); }
  }

  const createUser = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const form = e.target;
    run(async () => {
      await api('/api/users', { method: 'POST', body: { username: f.username, email: f.email, password: f.password, orgId: f.orgId, deptId: f.deptId || null } });
      form.reset(); setOrgId('');
    }, `User ${f.username} created.`);
  };

  return (
    <>
      <h1>Users &amp; roles</h1>
      <p className="lead">Assign and revoke roles. The database blocks invalid combinations, such as one person holding both ADMIN and AUDITOR.</p>
      {msg?.err && <div className="note err" role="alert">{msg.err}</div>}
      {msg?.ok && <div className="note ok">{msg.ok}</div>}

      {isAdmin && (
        <div className="card">
          <h2>Create user</h2>
          <form className="row" onSubmit={createUser}>
            <label>Username<input name="username" required minLength={3} /></label>
            <label>E-mail<input name="email" type="email" /></label>
            <label>Password<input name="password" type="password" required minLength={8} /></label>
            <label>Organisation
              <select name="orgId" required value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">Choose...</option>{d.orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.org_name}</option>)}
              </select></label>
            <label>Department
              <select name="deptId"><option value="">None</option>
                {d.depts.filter((x) => String(x.org_id) === orgId).map((x) => <option key={x.dept_id} value={x.dept_id}>{x.dept_name}</option>)}
              </select></label>
            <button>Create user</button>
          </form>
        </div>
      )}

      <div className="card">
        <form className="row" onSubmit={(e) => { e.preventDefault(); load(q); }}>
          <label>Search by username or e-mail<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="ghost">Search</button>
        </form>
        <div className="scroll">
          <table>
            <thead><tr><th>User</th><th>Organisation / department</th><th>Status</th><th>Roles</th>{isAdmin && <th>Manage</th>}</tr></thead>
            <tbody>
              {d.users.map((u) => {
                const ids = u.role_ids ? u.role_ids.split(',') : [];
                return (
                  <tr key={u.user_id}>
                    <td><b>{u.username}</b><br /><span className="mono">{u.email || ''}</span></td>
                    <td>{u.org_name}<br />{u.dept_name || '-'}</td>
                    <td><span className={`pill ${u.status}`}>{u.status}</span></td>
                    <td>
                      {u.roles ? u.roles.split(', ').map((name, i) => (
                        <span key={name} style={{ marginRight: '.5rem', whiteSpace: 'nowrap' }}>{name}
                          {isAdmin && <button className="danger small" style={{ marginLeft: '.25rem' }} aria-label={`Revoke ${name} from ${u.username}`}
                            onClick={() => run(() => api(`/api/users/${u.user_id}/roles?roleId=${ids[i]}`, { method: 'DELETE' }), `Revoked ${name} from ${u.username}.`)}>x</button>}
                        </span>)) : <em>none</em>}
                    </td>
                    {isAdmin && (
                      <td>
                        <select aria-label={`Add role to ${u.username}`} value="" onChange={(e) => {
                          const rid = e.target.value; if (!rid) return;
                          const rn = roles.find((r) => String(r.role_id) === rid)?.role_name;
                          run(() => api(`/api/users/${u.user_id}/roles`, { method: 'POST', body: { roleId: rid } }), `Assigned ${rn} to ${u.username}.`);
                        }}>
                          <option value="">Add role...</option>
                          {roles.filter((r) => !ids.includes(String(r.role_id))).map((r) => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                        </select>{' '}
                        {u.status === 'ACTIVE'
                          ? <button className="danger small" onClick={() => run(() => api(`/api/users/${u.user_id}`, { method: 'PATCH', body: { status: 'INACTIVE' } }), `${u.username} deactivated.`)}>Deactivate</button>
                          : <button className="ghost small" onClick={() => run(() => api(`/api/users/${u.user_id}`, { method: 'PATCH', body: { status: 'ACTIVE' } }), `${u.username} reactivated.`)}>Reactivate</button>}
                      </td>)}
                  </tr>);
              })}
              {d.users.length === 0 && <tr><td colSpan={5}>No users match that search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Roles</h2>
        <div className="scroll"><table><thead><tr><th>Role</th><th>Scope</th><th>Permissions</th><th>Users</th><th>Description</th></tr></thead>
          <tbody>{roles.map((r) => (<tr key={r.role_id}><td><b>{r.role_name}</b></td><td>{r.scope_type}</td><td>{r.permission_count}</td><td>{r.user_count}</td><td>{r.description}</td></tr>))}</tbody></table></div>
      </div>
    </>
  );
}
