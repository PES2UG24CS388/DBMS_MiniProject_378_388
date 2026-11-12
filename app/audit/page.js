'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, fmt } from '@/lib/api';

export default function Audit() {
  const [f, setF] = useState({ q: '', result: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [days, setDays] = useState(90);
  const [msg, setMsg] = useState(null);
  const [me, setMe] = useState(null);

  const load = useCallback(async (p = 1, filters = f) => {
    const qs = new URLSearchParams({ page: p, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    try { setData(await api('/api/audit?' + qs)); setPage(p); } catch (e) { setMsg({ err: e.message }); }
  }, [f]);

  useEffect(() => { api('/api/auth/me').then(setMe).catch(() => {}); load(1); }, []); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pages = Math.max(1, Math.ceil(data.total / 25));

  async function archive() {
    setMsg(null);
    try { const r = await api('/api/audit/archive', { method: 'POST', body: { days: Number(days) } });
      setMsg({ ok: `${r.archived} entries older than ${days} days archived.` }); load(1); }
    catch (e) { setMsg({ err: e.message }); }
  }

  return (
    <>
      <h1>Audit trail</h1>
      <p className="lead">Entries cannot be edited or deleted; the database refuses both. Search uses full-text matching, for example: <span className="mono">+payroll +denied</span>.</p>
      {msg?.err && <div className="note err" role="alert">{msg.err}</div>}
      {msg?.ok && <div className="note ok">{msg.ok}</div>}
      <div className="card">
        <form className="row" onSubmit={(e) => { e.preventDefault(); load(1); }}>
          <label>Search<input value={f.q} onChange={set('q')} placeholder="payroll denied" /></label>
          <label>Result<select value={f.result} onChange={set('result')}>
            <option value="">Any</option>{['ALLOW', 'DENY', 'SUCCESS', 'FAILURE'].map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>From<input type="date" value={f.from} onChange={set('from')} /></label>
          <label>To<input type="date" value={f.to} onChange={set('to')} /></label>
          <button>Apply filters</button>
          <button type="button" className="ghost" onClick={() => { const e = { q: '', result: '', from: '', to: '' }; setF(e); load(1, e); }}>Clear</button>
        </form>
        <div className="scroll">
          <table>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Resource</th><th>Result</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.audit_id}>
                  <td className="mono">{fmt(r.timestamp)}</td><td>{r.username || '-'}</td><td>{r.action}</td><td>{r.resource}</td>
                  <td>{r.result && <span className={`pill ${r.result}`}>{r.result}</span>}</td>
                  <td>{r.details}{r.archived ? ' (archived)' : ''}</td><td className="mono">{r.ip_address || '-'}</td>
                </tr>))}
              {data.rows.length === 0 && <tr><td colSpan={7}>No entries match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: '.9rem', alignItems: 'center' }}>
          <button className="ghost small" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
          <span>Page {page} of {pages} ({data.total} entries)</span>
          <button className="ghost small" disabled={page >= pages} onClick={() => load(page + 1)}>Next</button>
        </div>
      </div>
      {me?.roles.includes('ADMIN') && (
        <div className="card">
          <h2>Archive old entries</h2>
          <div className="row">
            <label>Older than (days)<input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></label>
            <button onClick={archive}>Archive entries</button>
          </div>
        </div>)}
    </>
  );
}
