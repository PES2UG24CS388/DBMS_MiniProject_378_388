'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export default function Policies() {
  const [rules, setRules] = useState([]);
  const [me, setMe] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => api('/api/policies').then((d) => setRules(d.rules)).catch((e) => setMsg({ err: e.message })), []);
  useEffect(() => { api('/api/auth/me').then(setMe).catch(() => {}); load(); }, [load]);

  async function toggle(r) {
    const status = r.rule_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try { await api(`/api/policies/rules/${r.policy_rule_id}`, { method: 'PATCH', body: { status } });
      setMsg({ ok: `Rule "${r.rule_name}" is now ${status.toLowerCase()}.` }); load(); }
    catch (e) { setMsg({ err: e.message }); }
  }

  return (
    <>
      <h1>Policies</h1>
      <p className="lead">Deny rules override role permissions. A condition of EXCEPT_ROLE:NAME exempts users who hold that role.</p>
      {msg?.err && <div className="note err" role="alert">{msg.err}</div>}
      {msg?.ok && <div className="note ok">{msg.ok}</div>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Policy</th><th>Rule</th><th>Effect</th><th>Action on resource</th><th>Condition</th><th>Times triggered</th><th>Status</th>{me?.roles.includes('ADMIN') && <th></th>}</tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.policy_rule_id}>
                <td>{r.policy_name}</td><td>{r.rule_name}</td>
                <td><span className={`pill ${r.effect}`}>{r.effect}</span></td>
                <td>{r.action} {r.resource || 'any'}</td><td className="mono">{r.rule_condition || '-'}</td>
                <td>{r.times_triggered}</td><td><span className={`pill ${r.rule_status}`}>{r.rule_status}</span></td>
                {me?.roles.includes('ADMIN') && <td><button className="ghost small" onClick={() => toggle(r)}>{r.rule_status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></td>}
              </tr>))}
          </tbody>
        </table>
      </div>
    </>
  );
}
