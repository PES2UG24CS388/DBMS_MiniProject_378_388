import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { withTx, dbError } from '@/lib/db';

export async function PATCH(req, { params }) {
  const { s, res } = await guard(['ADMIN']);
  if (res) return res;
  const { status } = await req.json().catch(() => ({}));
  if (!['ACTIVE', 'INACTIVE'].includes(status))
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  try {
    await withTx(async (c) => {
      const [r] = await c.query('UPDATE policy_rule SET status = ? WHERE policy_rule_id = ?', [status, Number(params.id)]);
      if (!r.affectedRows) throw Object.assign(new Error('nf'), { code: 'NOT_FOUND' });
      await c.query(
        `INSERT INTO audit_log (session_id, user_id, action, resource, resource_id, result, details)
         VALUES (?, ?, 'POLICY_RULE_CHANGED', 'policy', ?, 'SUCCESS', ?)`,
        [s.sessionId, s.userId, String(params.id), `Rule ${params.id} set to ${status}`]);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'NOT_FOUND') return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    const { status: st, message } = dbError(e);
    return NextResponse.json({ error: message }, { status: st });
  }
}
