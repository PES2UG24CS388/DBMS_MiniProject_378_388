import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { guard } from '@/lib/auth';
import { query, dbError } from '@/lib/db';

export async function GET(req) {
  const { res } = await guard(['ADMIN', 'AUDITOR']);
  if (res) return res;
  const q = new URL(req.url).searchParams.get('q')?.trim();
  const rows = q
    ? await query('SELECT * FROM v_user_role_summary WHERE username LIKE ? OR email LIKE ? ORDER BY user_id',
                  [`%${q}%`, `%${q}%`])
    : await query('SELECT * FROM v_user_role_summary ORDER BY user_id');
  const orgs = await query('SELECT org_id, org_name FROM organization WHERE status = "ACTIVE"');
  const depts = await query('SELECT dept_id, org_id, dept_name FROM department WHERE status = "ACTIVE"');
  return NextResponse.json({ users: rows, orgs, depts });
}

export async function POST(req) {
  const { s, res } = await guard(['ADMIN']);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (!b.username || !b.password || !b.orgId)
    return NextResponse.json({ error: 'Username, password and organisation are required' }, { status: 400 });
  if (String(b.password).length < 8)
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  try {
    const hash = await bcrypt.hash(b.password, 10);
    const r = await query(
      'INSERT INTO user_account (username, email, password_hash, org_id, dept_id) VALUES (?, ?, ?, ?, ?)',
      [b.username.trim(), b.email?.trim() || null, hash, b.orgId, b.deptId || null]);
    await query(
      `INSERT INTO audit_log (session_id, user_id, action, resource, resource_id, result, details)
       VALUES (?, ?, 'USER_CREATED', 'user', ?, 'SUCCESS', ?)`,
      [s.sessionId, s.userId, String(r.insertId), `Created user ${b.username}`]);
    return NextResponse.json({ ok: true, userId: r.insertId }, { status: 201 });
  } catch (e) {
    const { status, message } = dbError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
