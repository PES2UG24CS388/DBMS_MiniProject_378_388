import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req) {
  const { res } = await guard(['ADMIN', 'AUDITOR']);
  if (res) return res;
  const p = new URL(req.url).searchParams;
  const q = p.get('q')?.trim();
  const result = p.get('result');
  const from = p.get('from');
  const to = p.get('to');
  const page = Math.max(1, Number(p.get('page')) || 1);

  const where = [];
  const args = [];
  if (q) { where.push('MATCH(a.action, a.resource, a.details) AGAINST (? IN BOOLEAN MODE)'); args.push(q); }
  if (['ALLOW', 'DENY', 'SUCCESS', 'FAILURE'].includes(result)) { where.push('a.result = ?'); args.push(result); }
  if (from) { where.push('a.timestamp >= ?'); args.push(from); }
  if (to)   { where.push('a.timestamp < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(to); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = await query(
    `SELECT a.audit_id, a.timestamp, u.username, a.action, a.resource, a.result, a.details,
            a.policy_rule_id, a.ip_address, (x.audit_id IS NOT NULL) AS archived
     FROM audit_log a
     LEFT JOIN user_account u  ON u.user_id = a.user_id
     LEFT JOIN audit_archive x ON x.audit_id = a.audit_id
     ${w} ORDER BY a.audit_id DESC LIMIT 25 OFFSET ?`, [...args, (page - 1) * 25]);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM audit_log a ${w}`, args);
  return NextResponse.json({ rows, total, page, pageSize: 25 });
}
