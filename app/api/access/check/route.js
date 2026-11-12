import { NextResponse } from 'next/server';
import { guard, clientIp } from '@/lib/auth';
import { pool, query, dbError } from '@/lib/db';
import { logEvent } from '@/lib/mongo';

// "Can user X do ACTION on RESOURCE?"  Everyone may test themselves; ADMIN/AUDITOR may test anyone.
export async function GET(req) {
  const { s, res } = await guard();
  if (res) return res;
  const p = new URL(req.url).searchParams;
  const action = p.get('action')?.trim().toUpperCase();
  const resource = p.get('resource')?.trim().toLowerCase();
  let target = Number(p.get('userId')) || s.userId;
  if (!action || !resource)
    return NextResponse.json({ error: 'action and resource are required' }, { status: 400 });
  if (target !== s.userId && !s.roles.some((r) => ['ADMIN', 'AUDITOR'].includes(r)))
    return NextResponse.json({ error: 'You may only test your own access' }, { status: 403 });
  try {
    const [sets] = await pool.query('CALL sp_check_access(?, ?, ?, ?, ?)',
      [target, action, resource, s.sessionId, clientIp(req)]);
    const d = sets[0][0];
    const [u] = await query('SELECT username FROM user_account WHERE user_id = ?', [target]);
    await logEvent({
      type: 'ACCESS_CHECK', userId: target, username: u?.username ?? 'unknown', action, resource,
      decision: d.decision, ip: clientIp(req),
      context: { reason: d.reason, matchedRules: d.rule_id ? [{ ruleId: d.rule_id, effect: 'DENY' }] : [],
                 requestedBy: s.username }
    });
    return NextResponse.json({ ...d, username: u?.username });
  } catch (e) {
    const { status, message } = dbError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
