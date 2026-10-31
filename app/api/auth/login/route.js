import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signToken, clientIp } from '@/lib/auth';
import { logEvent } from '@/lib/mongo';

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password)
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });

  const ip = clientIp(req);
  const [user] = await query(
    'SELECT user_id, username, password_hash, status FROM user_account WHERE username = ?', [username]);

  const ok = user && user.status === 'ACTIVE' && user.password_hash &&
             (await bcrypt.compare(password, user.password_hash));

  if (!ok) {
    await query(
      `INSERT INTO audit_log (user_id, action, resource, result, ip_address, details)
       VALUES (?, 'LOGIN_FAILED', 'session', 'FAILURE', ?, ?)`,
      [user?.user_id ?? null, ip, `Failed login for "${String(username).slice(0, 60)}"`]);
    await logEvent({ type: 'LOGIN_FAILURE', username: String(username).slice(0, 100), ip,
                     context: { reason: user ? 'bad password or inactive' : 'unknown user' } });
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const roles = (await query(
    `SELECT r.role_name FROM user_role ur JOIN role r ON r.role_id = ur.role_id
     WHERE ur.user_id = ? AND ur.status = 'ACTIVE' AND r.status = 'ACTIVE'`, [user.user_id]
  )).map((r) => r.role_name);

  const ins = await query(
    'INSERT INTO session (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
    [user.user_id, ip, (req.headers.get('user-agent') || '').slice(0, 500)]);
  const sessionId = ins.insertId;

  await query(
    `INSERT INTO audit_log (session_id, user_id, action, resource, resource_id, result, ip_address, details)
     VALUES (?, ?, 'LOGIN', 'session', ?, 'SUCCESS', ?, 'User signed in')`,
    [sessionId, user.user_id, String(sessionId), ip]);
  await logEvent({ type: 'LOGIN_SUCCESS', userId: user.user_id, username: user.username, ip, context: { roles } });

  const token = await signToken({ userId: user.user_id, username: user.username, roles, sessionId });
  const res = NextResponse.json({ ok: true, username: user.username, roles });
  res.cookies.set('token', token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7200,
    secure: process.env.NODE_ENV === 'production'
  });
  return res;
}
