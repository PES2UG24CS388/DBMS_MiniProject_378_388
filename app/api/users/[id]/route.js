import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { withTx, dbError } from '@/lib/db';

// Activate / deactivate a user. Deactivation also closes that user's open sessions (one transaction).
export async function PATCH(req, { params }) {
  const { s, res } = await guard(['ADMIN']);
  if (res) return res;
  const { status } = await req.json().catch(() => ({}));
  const id = Number(params.id);
  if (!['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status))
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  if (id === s.userId && status !== 'ACTIVE')
    return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
  try {
    await withTx(async (c) => {
      const [r] = await c.query('UPDATE user_account SET status = ? WHERE user_id = ?', [status, id]);
      if (!r.affectedRows) throw Object.assign(new Error('nf'), { code: 'NOT_FOUND' });
      if (status !== 'ACTIVE')
        await c.query("UPDATE session SET status = 'CLOSED', logout_time = NOW() WHERE user_id = ? AND status = 'ACTIVE'", [id]);
      await c.query(
        `INSERT INTO audit_log (session_id, user_id, action, resource, resource_id, result, details)
         VALUES (?, ?, 'USER_STATUS_CHANGED', 'user', ?, 'SUCCESS', ?)`,
        [s.sessionId, s.userId, String(id), `Status set to ${status}`]);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'NOT_FOUND') return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { status: st, message } = dbError(e);
    return NextResponse.json({ error: message }, { status: st });
  }
}
