import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { pool, withTx, dbError } from '@/lib/db';

// Assign a role -> stored procedure (transaction + validation + triggers inside the database)
export async function POST(req, { params }) {
  const { s, res } = await guard(['ADMIN']);
  if (res) return res;
  const { roleId } = await req.json().catch(() => ({}));
  if (!roleId) return NextResponse.json({ error: 'roleId is required' }, { status: 400 });
  try {
    await pool.query('CALL sp_assign_role(?, ?, ?)', [Number(params.id), Number(roleId), s.userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, message } = dbError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

// Revoke a role -> app-level transaction; @actor_id lets the DELETE trigger record who did it
export async function DELETE(req, { params }) {
  const { s, res } = await guard(['ADMIN']);
  if (res) return res;
  const roleId = Number(new URL(req.url).searchParams.get('roleId'));
  const userId = Number(params.id);
  if (!roleId) return NextResponse.json({ error: 'roleId is required' }, { status: 400 });
  try {
    await withTx(async (c) => {
      await c.query('SET @actor_id = ?', [s.userId]);
      const [last] = await c.query(
        `SELECT COUNT(*) AS n FROM user_role WHERE user_id = ? AND status = 'ACTIVE' FOR UPDATE`, [userId]);
      if (last[0].n <= 1)
        throw Object.assign(new Error('last'), { code: 'LAST_ROLE' });
      const [r] = await c.query('DELETE FROM user_role WHERE user_id = ? AND role_id = ?', [userId, roleId]);
      if (!r.affectedRows) throw Object.assign(new Error('nf'), { code: 'NOT_FOUND' });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'LAST_ROLE')
      return NextResponse.json({ error: 'A user must keep at least one role' }, { status: 422 });
    if (e.code === 'NOT_FOUND')
      return NextResponse.json({ error: 'That role is not assigned to the user' }, { status: 404 });
    const { status, message } = dbError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
