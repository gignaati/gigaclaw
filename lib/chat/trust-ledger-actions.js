'use server';
import { auth } from '../auth/index.js';

/**
 * Require authentication — throws if not logged in.
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user;
}

/**
 * Get paginated audit log entries.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @param {number} [opts.offset=0]
 * @param {string} [opts.actionType]  - Filter by action type
 * @param {number} [opts.days]        - Look-back window in days (e.g. 7, 30)
 * @returns {Promise<{ entries: object[], total: number }>}
 */
export async function getAuditLogEntries({ limit = 50, offset = 0, actionType, days } = {}) {
  await requireAuth();
  const { getAuditLog, getAuditLogCount } = await import('../db/audit-log.js');
  const since = days ? Date.now() - days * 24 * 60 * 60 * 1000 : undefined;
  const entries = getAuditLog({ limit, offset, actionType, since });
  const total = getAuditLogCount({ actionType, since });
  return { entries, total };
}

/**
 * Verify the hash chain integrity of the full audit log.
 * @returns {Promise<{ intact: boolean, totalEntries: number, brokenAt?: number, brokenEntryId?: string, reason?: string }>}
 */
export async function verifyAuditChain() {
  await requireAuth();
  const { verifyAuditChain: verify } = await import('../db/audit-log.js');
  return verify();
}

/**
 * Get data egress summary — token aggregation by LLM provider.
 * @param {number} [days=30]
 * @returns {Promise<object>}
 */
export async function getEgressSummary(days = 30) {
  await requireAuth();
  const { getEgressSummary: summary } = await import('../db/audit-log.js');
  return summary(days);
}

/**
 * Export the full audit log as a JSON string (for download).
 * @returns {Promise<string>} JSON string
 */
export async function exportAuditLog() {
  await requireAuth();
  const { exportAuditLogJson } = await import('../db/audit-log.js');
  return JSON.stringify(exportAuditLogJson(), null, 2);
}
