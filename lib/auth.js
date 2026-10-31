import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from './db';

const key = () => new TextEncoder().encode(process.env.JWT_SECRET);

export const signToken = (payload) =>
  new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(key());

export async function verifyToken(token) {
  try { return (await jwtVerify(token, key())).payload; } catch { return null; }
}

export const clientIp = (req) =>
  (req.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();

// Route guard: valid JWT + ACTIVE session row + (optional) one of the allowed roles.
export async function guard(allowedRoles) {
  const token = cookies().get('token')?.value;
  const s = token ? await verifyToken(token) : null;
  if (!s) return { res: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };

  const rows = await query(
    `SELECT s.status AS s_status, u.status AS u_status FROM session s
     JOIN user_account u ON u.user_id = s.user_id WHERE s.session_id = ? AND s.user_id = ?`,
    [s.sessionId, s.userId]);
  if (!rows[0] || rows[0].s_status !== 'ACTIVE' || rows[0].u_status !== 'ACTIVE')
    return { res: NextResponse.json({ error: 'Session expired' }, { status: 401 }) };

  if (allowedRoles && !allowedRoles.some((r) => s.roles.includes(r)))
    return { res: NextResponse.json({ error: 'Your role is not allowed to do this' }, { status: 403 }) };

  return { s };
}
