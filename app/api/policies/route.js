import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const { res } = await guard(['ADMIN', 'AUDITOR']);
  if (res) return res;
  const rules = await query(
    `SELECT p.policy_id, p.policy_name, p.status AS policy_status, pr.policy_rule_id, pr.rule_name,
            pr.status AS rule_status, pr.action, pr.effect, pr.resource, pr.rule_condition,
            (SELECT COUNT(*) FROM audit_log a WHERE a.policy_rule_id = pr.policy_rule_id) AS times_triggered
     FROM policy p JOIN policy_rule pr ON pr.policy_id = p.policy_id
     ORDER BY p.policy_id, pr.policy_rule_id`);
  return NextResponse.json({ rules });
}
