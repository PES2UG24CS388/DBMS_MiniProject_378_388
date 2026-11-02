import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { pool, dbError } from '@/lib/db';

export async function POST(req) {
  const { s, res } = await guard(['ADMIN']);
  if (res) return res;
  const { days } = await req.json().catch(() => ({}));
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ error: 'days must be a whole number of at least 1' }, { status: 400 });
  try {
    // Policy engine applies to this feature too: ask the database whether the caller may archive.
    const [chk] = await pool.query('CALL sp_check_access(?, "ARCHIVE", "audit_log", ?, NULL)', [s.userId, s.sessionId]);
    if (chk[0][0].decision !== 'ALLOW')
      return NextResponse.json({ error: `Archive blocked: ${chk[0][0].reason}` }, { status: 403 });
    const [sets] = await pool.query('CALL sp_archive_audit(?, ?)', [n, s.userId]);
    return NextResponse.json({ archived: sets[0][0].archived });
  } catch (e) {
    const { status, message } = dbError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
