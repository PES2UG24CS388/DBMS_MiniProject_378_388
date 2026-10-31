import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifyToken, clientIp } from '@/lib/auth';

export async function POST(req) {
  const token = cookies().get('token')?.value;
  const s = token ? await verifyToken(token) : null;
  if (s) {
    await query("UPDATE session SET status = 'CLOSED', logout_time = NOW() WHERE session_id = ?", [s.sessionId]);
    await query(
      `INSERT INTO audit_log (session_id, user_id, action, resource, result, ip_address, details)
       VALUES (?, ?, 'LOGOUT', 'session', 'SUCCESS', ?, 'User signed out')`,
      [s.sessionId, s.userId, clientIp(req)]);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('token', '', { path: '/', maxAge: 0 });
  return res;
}
