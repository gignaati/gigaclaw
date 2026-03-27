/**
 * Trust Ledger — Audit Log DB Module
 *
 * Provides tamper-evident, append-only logging of every meaningful agent action.
 * Each entry is hash-chained to the previous one (SHA-256) so any deletion or
 * modification breaks the chain and is surfaced in the UI.
 *
 * Action types:
 *   llm_call      — prompt sent to an LLM provider
 *   shell_exec    — shell command executed by the agent
 *   file_write    — file written to disk by the agent
 *   webhook_post  — outbound HTTP call to a webhook URL
 *   telegram_send — message sent via Telegram
 *   job_create    — agent job created
 *
 * Metadata schema per action type:
 *   llm_call:     { provider, model, tokens_in, tokens_out, is_local }
 *   shell_exec:   { command, exit_code, cwd }
 *   file_write:   { path, size_bytes }
 *   webhook_post: { url, method, status_code }
 *   telegram_send:{ chat_id, message_length }
 *   job_create:   { job_id, title, provider }
 */

import { createHash, randomUUID } from 'crypto';
import { eq, desc, gte, sql } from 'drizzle-orm';
import { getDb } from './index.js';
import { auditLog } from './schema.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Providers considered "local" (no data leaves the machine) */
const LOCAL_PROVIDERS = new Set(['ollama', 'pragatigpt']);

/** Genesis hash — used as prev_hash for the very first entry */
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of a canonical JSON string of an entry's core fields.
 * We hash: id + timestamp + action_type + actor + target + summary + metadata + prev_hash
 */
function hashEntry(entry) {
  const canonical = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    actionType: entry.actionType,
    actor: entry.actor,
    target: entry.target,
    summary: entry.summary,
    metadata: entry.metadata,
    prevHash: entry.prevHash,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Get the hash of the most recent audit log entry (for chaining).
 * Returns GENESIS_HASH if the log is empty.
 */
function getLatestHash() {
  const db = getDb();
  const row = db
    .select({ entryHash: auditLog.entryHash })
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(1)
    .get();
  return row?.entryHash ?? GENESIS_HASH;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Log an agent action as a tamper-evident audit entry.
 *
 * @param {object} params
 * @param {string} params.actionType  - One of: llm_call, shell_exec, file_write, webhook_post, telegram_send, job_create
 * @param {string} params.actor       - Who triggered the action (e.g. 'user:admin', 'agent:cron', 'api:webhook')
 * @param {string} params.target      - What was acted upon (e.g. 'provider:ollama', 'file:/workspace/out.py')
 * @param {string} params.summary     - One-line human-readable description
 * @param {object} [params.metadata]  - Structured metadata (provider, tokens, exit_code, etc.)
 * @returns {object} The created audit log entry
 */
export function logAction({ actionType, actor, target, summary, metadata = {} }) {
  try {
    const db = getDb();
    const now = Date.now();
    const id = randomUUID();
    const prevHash = getLatestHash();

    const entry = {
      id,
      timestamp: now,
      actionType,
      actor,
      target,
      summary,
      metadata: JSON.stringify(metadata),
      prevHash,
      entryHash: '', // computed below
    };

    // Compute hash over all fields including prevHash
    entry.entryHash = hashEntry(entry);

    db.insert(auditLog).values(entry).run();
    return entry;
  } catch (err) {
    // Audit logging must never crash the main flow — log to console only
    console.error('[audit-log] Failed to log action:', err.message);
    return null;
  }
}

/**
 * Get paginated audit log entries, newest first.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=100]
 * @param {number} [opts.offset=0]
 * @param {string} [opts.actionType]   - Filter by action type
 * @param {string} [opts.actor]        - Filter by actor prefix
 * @param {number} [opts.since]        - Unix ms — only entries after this timestamp
 * @returns {object[]}
 */
export function getAuditLog({ limit = 100, offset = 0, actionType, actor, since } = {}) {
  const db = getDb();
  let query = db.select().from(auditLog);

  const conditions = [];
  if (actionType) conditions.push(eq(auditLog.actionType, actionType));
  if (since) conditions.push(gte(auditLog.timestamp, since));

  if (conditions.length > 0) {
    const { and } = require('drizzle-orm');
    query = query.where(and(...conditions));
  }

  const rows = query
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map((r) => ({
    ...r,
    metadata: (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })(),
  }));
}

/**
 * Get total count of audit log entries (for pagination).
 * @param {object} [opts]
 * @param {string} [opts.actionType]
 * @param {number} [opts.since]
 * @returns {number}
 */
export function getAuditLogCount({ actionType, since } = {}) {
  const db = getDb();
  let query = db.select({ count: sql`count(*)` }).from(auditLog);

  const conditions = [];
  if (actionType) conditions.push(eq(auditLog.actionType, actionType));
  if (since) conditions.push(gte(auditLog.timestamp, since));

  if (conditions.length > 0) {
    const { and } = require('drizzle-orm');
    query = query.where(and(...conditions));
  }

  const result = query.get();
  return result?.count ?? 0;
}

/**
 * Verify the hash chain integrity of the entire audit log.
 * Reads all entries in insertion order and re-computes each hash.
 *
 * @returns {{ intact: boolean, totalEntries: number, brokenAt?: number, brokenEntryId?: string }}
 */
export function verifyAuditChain() {
  const db = getDb();
  const rows = db
    .select()
    .from(auditLog)
    .orderBy(auditLog.timestamp, auditLog.id) // stable order
    .all();

  if (rows.length === 0) {
    return { intact: true, totalEntries: 0 };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check prev_hash linkage
    if (row.prevHash !== expectedPrevHash) {
      return {
        intact: false,
        totalEntries: rows.length,
        brokenAt: i + 1,
        brokenEntryId: row.id,
        reason: 'prev_hash mismatch',
      };
    }

    // Re-compute entry hash
    const computed = hashEntry({
      id: row.id,
      timestamp: row.timestamp,
      actionType: row.actionType,
      actor: row.actor,
      target: row.target,
      summary: row.summary,
      metadata: row.metadata,
      prevHash: row.prevHash,
    });

    if (computed !== row.entryHash) {
      return {
        intact: false,
        totalEntries: rows.length,
        brokenAt: i + 1,
        brokenEntryId: row.id,
        reason: 'entry_hash mismatch — entry may have been modified',
      };
    }

    expectedPrevHash = row.entryHash;
  }

  return { intact: true, totalEntries: rows.length };
}

/**
 * Get data egress summary — token counts aggregated by LLM provider.
 * Used for the Data Egress Visibility Panel.
 *
 * @param {number} [days=30] - Look-back window in days
 * @returns {object} Summary object with per-provider stats and totals
 */
export function getEgressSummary(days = 30) {
  const db = getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const rows = db
    .select()
    .from(auditLog)
    .where(
      sql`${auditLog.actionType} = 'llm_call' AND ${auditLog.timestamp} >= ${since}`
    )
    .all();

  const providerStats = {};
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let localTokensIn = 0;
  let localTokensOut = 0;

  for (const row of rows) {
    let meta = {};
    try { meta = JSON.parse(row.metadata); } catch { /* skip */ }

    const provider = meta.provider || 'unknown';
    const tokensIn = meta.tokens_in || 0;
    const tokensOut = meta.tokens_out || 0;
    const isLocal = meta.is_local ?? LOCAL_PROVIDERS.has(provider);

    if (!providerStats[provider]) {
      providerStats[provider] = {
        provider,
        label: getProviderLabel(provider),
        isLocal,
        tokensIn: 0,
        tokensOut: 0,
        callCount: 0,
      };
    }

    providerStats[provider].tokensIn += tokensIn;
    providerStats[provider].tokensOut += tokensOut;
    providerStats[provider].callCount += 1;

    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    if (isLocal) {
      localTokensIn += tokensIn;
      localTokensOut += tokensOut;
    }
  }

  const totalTokens = totalTokensIn + totalTokensOut;
  const localTokens = localTokensIn + localTokensOut;
  const localRatio = totalTokens > 0 ? Math.round((localTokens / totalTokens) * 100) : 0;

  return {
    days,
    since,
    providers: Object.values(providerStats).sort((a, b) => (b.tokensIn + b.tokensOut) - (a.tokensIn + a.tokensOut)),
    totalTokensIn,
    totalTokensOut,
    totalTokens,
    localTokens,
    cloudTokens: totalTokens - localTokens,
    localRatio,
    cloudRatio: 100 - localRatio,
    totalCalls: rows.length,
  };
}

/**
 * Export the full audit log as a JSON array (for download).
 * @returns {object[]}
 */
export function exportAuditLogJson() {
  const db = getDb();
  const rows = db
    .select()
    .from(auditLog)
    .orderBy(auditLog.timestamp)
    .all();

  return rows.map((r) => ({
    ...r,
    metadata: (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })(),
  }));
}

// ─── Provider label helper (mirrors model.js) ─────────────────────────────────

function getProviderLabel(provider) {
  const labels = {
    anthropic: 'Claude (Anthropic)',
    openai: 'GPT (OpenAI)',
    google: 'Gemini (Google)',
    pragatigpt: 'PragatiGPT (Gignaati)',
    ollama: 'Ollama (Local)',
    custom: 'Custom API',
    unknown: 'Unknown',
  };
  return labels[provider] || provider;
}
