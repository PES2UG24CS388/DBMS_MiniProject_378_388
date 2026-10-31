import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const { s, res } = await guard();
  if (res) return res;
  const perms = await query(
    `SELECT DISTINCT permission_name, action, resource FROM v_user_effective_permissions
     WHERE user_id = ? ORDER BY resource, action`, [s.userId]);
  return NextResponse.json({ userId: s.userId, username: s.username, roles: s.roles, permissions: perms });
}
