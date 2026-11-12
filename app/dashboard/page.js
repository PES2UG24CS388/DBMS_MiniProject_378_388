'use client';
import { useEffect, useState } from 'react';
import { api, fmt } from '@/lib/api';

const Bar = ({ allow, deny }) => {
  const t = allow + deny || 1;
  return (<div className="bar" title={`${allow} allowed, ${deny} denied`}>
    <i style={{ width: `${(allow / t) * 100}%`, background: 'var(--allow)' }} />
    <i style={{ width: `${(deny / t) * 100}%`, background: 'var(--deny)' }} /></div>);
};

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/auth/me').then((m) => {
      setMe(m);
      if (m.roles.some((r) => ['ADMIN', 'AUDITOR'].includes(r)))
        api('/api/analytics').then(setData).catch((e) => setErr(e.message));
    }).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="note err">{err}</div>;
  if (!me) return <p>Loading...</p>;
  const s = data?.stats;

  return (
    <>
      <h1>Overview</h1>
      <p className="lead">Signed in as {me.username}. Your access comes from: {me.roles.join(', ') || 'no active role'}.</p>

      {!data && (
        <div className="card">
          <h2>What you are allowed to do</h2>
          <div className="scroll"><table><thead><tr><th>Permission</th><th>Action</th><th>Resource</th></tr></thead>
            <tbody>{me.permissions.map((p) => (<tr key={p.permission_name}><td>{p.permission_name}</td><td>{p.action}</td><td>{p.resource}</td></tr>))}</tbody></table></div>
        </div>
      )}

      {s && (<>
        <div className="grid">
          <div className="stat"><b>{s.active_users}</b><span>active users</span></div>
          <div className="stat"><b>{s.roles}</b><span>roles</span></div>
          <div className="stat"><b>{s.open_sessions}</b><span>open sessions</span></div>
          <div className="stat"><b>{s.denials_24h}</b><span>denials in 24 h</span></div>
          <div className="stat"><b>{s.archived_entries}/{s.audit_entries}</b><span>entries archived</span></div>
        </div>

        {!data.mongo && <div className="note warn">MongoDB is not reachable, so event analytics are hidden. SQL data is unaffected.</div>}

        {data.mongo && data.mongo.bruteForce.length > 0 && (
          <div className="note err" role="alert">
            Possible password guessing in the last 24 h:{' '}
            {data.mongo.bruteForce.map((b) => `${b._id.username} from ${b._id.ip} (${b.failures} failures)`).join('; ')}
          </div>
        )}

        {data.mongo && (
          <div className="two">
            <div className="card">
              <h2>Access checks by resource (7 days)</h2>
              <div className="scroll"><table><thead><tr><th>Resource</th><th>Allowed / denied</th><th>Denied</th></tr></thead>
                <tbody>{data.mongo.byResource.map((r) => (
                  <tr key={r._id}><td>{r._id}</td><td><Bar allow={r.allow} deny={r.deny} /></td><td>{r.deny} of {r.total}</td></tr>))}</tbody></table></div>
            </div>
            <div className="card">
              <h2>Users denied most often</h2>
              <div className="scroll"><table><thead><tr><th>User</th><th>Denials</th><th>Last denied</th></tr></thead>
                <tbody>{data.mongo.topDenied.map((r) => (
                  <tr key={r._id}><td>{r._id}</td><td>{r.denials}</td><td className="mono">{fmt(r.lastSeen)}</td></tr>))}</tbody></table></div>
            </div>
            <div className="card">
              <h2>Checks per day</h2>
              <div className="scroll"><table><thead><tr><th>Day</th><th>Checks</th><th>Denied</th></tr></thead>
                <tbody>{data.mongo.daily.map((r) => (
                  <tr key={r._id}><td className="mono">{r._id}</td><td>{r.checks}</td><td>{r.denied}</td></tr>))}</tbody></table></div>
            </div>
            <div className="card">
              <h2>Accounts with no sign-in for 30+ days</h2>
              {data.dormant.length === 0 ? <p>None. Every active account has signed in recently.</p> : (
                <div className="scroll"><table><thead><tr><th>User</th><th>Last sign-in</th></tr></thead>
                  <tbody>{data.dormant.map((d) => (<tr key={d.username}><td>{d.username}</td><td className="mono">{d.last_login ? fmt(d.last_login) : 'never'}</td></tr>))}</tbody></table></div>)}
            </div>
          </div>
        )}
      </>)}
    </>
  );
}
