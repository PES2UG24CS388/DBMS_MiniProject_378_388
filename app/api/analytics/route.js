import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { query } from '@/lib/db';
import { events } from '@/lib/mongo';

export async function GET() {
  const { res } = await guard(['ADMIN', 'AUDITOR']);
  if (res) return res;

  // ---- SQL side: headline numbers ----
  const [stats] = await query(
    `SELECT (SELECT COUNT(*) FROM user_account WHERE status = 'ACTIVE')            AS active_users,
            (SELECT COUNT(*) FROM role WHERE status = 'ACTIVE')                    AS roles,
            (SELECT COUNT(*) FROM session WHERE status = 'ACTIVE')                 AS open_sessions,
            (SELECT COUNT(*) FROM audit_log WHERE result = 'DENY'
               AND timestamp >= NOW() - INTERVAL 1 DAY)                            AS denials_24h,
            (SELECT COUNT(*) FROM audit_log)                                       AS audit_entries,
            (SELECT COUNT(*) FROM audit_archive)                                   AS archived_entries`);
  const dormant = await query(
    `SELECT u.username, MAX(s.login_time) AS last_login
     FROM user_account u LEFT JOIN session s ON s.user_id = u.user_id
     WHERE u.status = 'ACTIVE' GROUP BY u.user_id, u.username
     HAVING last_login IS NULL OR last_login < NOW() - INTERVAL 30 DAY ORDER BY last_login`);

  // ---- NoSQL side: MongoDB aggregation pipelines ----
  let mongo = null;
  try {
    const col = await events();
    const since7 = new Date(Date.now() - 7 * 864e5);
    const since24 = new Date(Date.now() - 864e5);
    const [byResource, topDenied, bruteForce, daily] = await Promise.all([
      col.aggregate([
        { $match: { type: 'ACCESS_CHECK', ts: { $gte: since7 } } },
        { $group: { _id: '$resource',
            allow: { $sum: { $cond: [{ $eq: ['$decision', 'ALLOW'] }, 1, 0] } },
            deny:  { $sum: { $cond: [{ $eq: ['$decision', 'DENY'] }, 1, 0] } } } },
        { $addFields: { total: { $add: ['$allow', '$deny'] } } },
        { $sort: { deny: -1 } }, { $limit: 8 }
      ]).toArray(),
      col.aggregate([
        { $match: { type: 'ACCESS_CHECK', decision: 'DENY', ts: { $gte: since7 } } },
        { $group: { _id: '$username', denials: { $sum: 1 }, lastSeen: { $max: '$ts' } } },
        { $sort: { denials: -1 } }, { $limit: 5 }
      ]).toArray(),
      col.aggregate([
        { $match: { type: 'LOGIN_FAILURE', ts: { $gte: since24 } } },
        { $group: { _id: { ip: '$ip', username: '$username' }, failures: { $sum: 1 }, last: { $max: '$ts' } } },
        { $match: { failures: { $gte: 3 } } }, { $sort: { failures: -1 } }
      ]).toArray(),
      col.aggregate([
        { $match: { type: 'ACCESS_CHECK', ts: { $gte: since7 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } },
            checks: { $sum: 1 }, denied: { $sum: { $cond: [{ $eq: ['$decision', 'DENY'] }, 1, 0] } } } },
        { $sort: { _id: 1 } }
      ]).toArray()
    ]);
    mongo = { byResource, topDenied, bruteForce, daily };
  } catch (e) {
    console.error('Mongo analytics failed:', e.message);
  }
  return NextResponse.json({ stats, dormant, mongo });
}
