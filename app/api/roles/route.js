import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const { res } = await guard(['ADMIN', 'AUDITOR']);
  if (res) return res;
  const roles = await query(
    `SELECT r.role_id, r.role_name, r.description, r.scope_type,
            COUNT(DISTINCT rp.permission_id) AS permission_count,
            COUNT(DISTINCT ur.user_id)       AS user_count
     FROM role r
     LEFT JOIN role_permission rp ON rp.role_id = r.role_id AND rp.status = 'ACTIVE'
     LEFT JOIN user_role ur       ON ur.role_id = r.role_id AND ur.status = 'ACTIVE'
     WHERE r.status = 'ACTIVE'
     GROUP BY r.role_id, r.role_name, r.description, r.scope_type
     ORDER BY r.role_id`);
  return NextResponse.json({ roles });
}
