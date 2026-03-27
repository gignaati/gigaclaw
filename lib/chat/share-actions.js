'use server';
/**
 * Knowledge Base Document Sharing — Server Actions (v1.8.1)
 *
 * Provides Next.js server actions for sharing KB documents with external users:
 *   - createShareLink()     — generate a UUID share token with optional expiry/access cap
 *   - listShareLinks()      — list all active shares (optionally filtered by doc)
 *   - revokeShareLink()     — revoke a share token immediately
 *   - getSharedDocument()   — PUBLIC (no auth) — validate token and return document content
 *   - getShareStats()       — per-document share statistics
 *
 * Security model:
 *   - Tokens are random UUIDs (128-bit entropy) — not guessable
 *   - Expired tokens return 403 immediately
 *   - Revoked tokens return 403 immediately
 *   - Access-capped tokens return 403 once the cap is reached
 *   - All file reads are sandboxed to ~/gigaclaw-docs/ (path traversal protection)
 *   - Access count is incremented atomically on each valid access
 */

import { auth } from '../auth/index.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { getDb } from '../db/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Require authentication — throws if not logged in. */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user;
}

/** Resolve and validate a file path is inside ~/gigaclaw-docs/. */
function safeDocPath(docPath) {
  const docsDir = path.join(os.homedir(), 'gigaclaw-docs');
  const resolved = path.resolve(docPath);
  if (!resolved.startsWith(docsDir + path.sep) && resolved !== docsDir) {
    throw new Error('Access denied: path is outside the knowledge base directory.');
  }
  return resolved;
}

/** Build the public shareable URL for a token. */
function buildShareUrl(token) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/share/${token}`;
}

/** Get current Unix timestamp in seconds. */
function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// createShareLink
// ---------------------------------------------------------------------------

/**
 * Generate a shareable link for a Knowledge Base document.
 *
 * @param {string} docPath - Absolute path to the document in ~/gigaclaw-docs/
 * @param {object} options
 * @param {'view'|'download'} options.permission - Access level (default: 'view')
 * @param {number|null} options.expiresInDays    - Days until expiry (null = never)
 * @param {number|null} options.maxAccess        - Max access count (null = unlimited)
 * @returns {Promise<{ token: string, url: string, expiresAt: number|null }>}
 */
export async function createShareLink(docPath, options = {}) {
  const user = await requireAuth();
  const safePath = safeDocPath(docPath);

  if (!fs.existsSync(safePath)) {
    throw new Error(`Document not found: ${path.basename(safePath)}`);
  }

  const { permission = 'view', expiresInDays = null, maxAccess = null } = options;

  if (!['view', 'download'].includes(permission)) {
    throw new Error("Permission must be 'view' or 'download'.");
  }

  const token = crypto.randomUUID();
  const docName = path.basename(safePath);
  const expiresAt = expiresInDays
    ? nowSec() + expiresInDays * 86400
    : null;

  const db = getDb();
  db.prepare(
    `INSERT INTO share_tokens
       (id, user_id, doc_path, doc_name, permission, expires_at, access_count, max_access, revoked, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?)`
  ).run(token, user.id, safePath, docName, permission, expiresAt, maxAccess, nowSec());

  return { token, url: buildShareUrl(token), expiresAt };
}

// ---------------------------------------------------------------------------
// listShareLinks
// ---------------------------------------------------------------------------

/**
 * List all share tokens created by the current user.
 *
 * @param {string|null} docPath - Optional filter by document path
 * @returns {Promise<Array<object>>}
 */
export async function listShareLinks(docPath = null) {
  const user = await requireAuth();
  const db = getDb();

  let rows;
  if (docPath) {
    const safePath = safeDocPath(docPath);
    rows = db
      .prepare(
        `SELECT * FROM share_tokens WHERE user_id = ? AND doc_path = ? ORDER BY created_at DESC`
      )
      .all(user.id, safePath);
  } else {
    rows = db
      .prepare(`SELECT * FROM share_tokens WHERE user_id = ? ORDER BY created_at DESC`)
      .all(user.id);
  }

  const now = nowSec();
  return rows.map((row) => ({
    ...row,
    url: buildShareUrl(row.id),
    isExpired: row.expires_at ? row.expires_at < now : false,
    isExhausted: row.max_access ? row.access_count >= row.max_access : false,
    isActive: !row.revoked && !(row.expires_at && row.expires_at < now) &&
              !(row.max_access && row.access_count >= row.max_access),
  }));
}

// ---------------------------------------------------------------------------
// revokeShareLink
// ---------------------------------------------------------------------------

/**
 * Revoke a share token immediately.
 * Only the token owner can revoke it.
 *
 * @param {string} tokenId - The UUID share token to revoke
 * @returns {Promise<{ success: boolean }>}
 */
export async function revokeShareLink(tokenId) {
  const user = await requireAuth();
  const db = getDb();

  const row = db
    .prepare(`SELECT * FROM share_tokens WHERE id = ? AND user_id = ?`)
    .get(tokenId, user.id);

  if (!row) throw new Error('Share token not found or you do not have permission to revoke it.');

  db.prepare(`UPDATE share_tokens SET revoked = 1 WHERE id = ?`).run(tokenId);

  return { success: true };
}

// ---------------------------------------------------------------------------
// getSharedDocument  (PUBLIC — no auth required)
// ---------------------------------------------------------------------------

/**
 * Retrieve a shared document by token — no authentication required.
 * Validates token state (revoked, expired, access cap) and returns document content.
 *
 * @param {string} token - The UUID share token from the URL
 * @returns {Promise<{ docName: string, content: string, permission: string, mimeType: string }>}
 */
export async function getSharedDocument(token) {
  if (!token || typeof token !== 'string' || token.length > 64) {
    throw new Error('Invalid share token.');
  }

  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM share_tokens WHERE id = ?`)
    .get(token);

  if (!row) throw new Error('Share link not found or has been deleted.');
  if (row.revoked) throw new Error('This share link has been revoked by the owner.');

  const now = nowSec();
  if (row.expires_at && row.expires_at < now) {
    throw new Error('This share link has expired.');
  }
  if (row.max_access && row.access_count >= row.max_access) {
    throw new Error('This share link has reached its maximum number of accesses.');
  }

  // Validate the file still exists and is inside the docs dir
  const docsDir = path.join(os.homedir(), 'gigaclaw-docs');
  const resolved = path.resolve(row.doc_path);
  if (!resolved.startsWith(docsDir + path.sep)) {
    throw new Error('Access denied.');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('The shared document no longer exists in the knowledge base.');
  }

  // Increment access count atomically
  db.prepare(`UPDATE share_tokens SET access_count = access_count + 1 WHERE id = ?`).run(token);

  // Determine MIME type from extension
  const ext = path.extname(row.doc_name).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.csv': 'text/csv',
    '.json': 'application/json',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // For text-based formats, return content as string; for binary, return base64
  let content;
  const textExts = ['.txt', '.md', '.html', '.csv', '.json'];
  if (textExts.includes(ext)) {
    content = fs.readFileSync(resolved, 'utf8');
  } else {
    // Return base64 for binary formats (PDF, DOCX)
    content = fs.readFileSync(resolved).toString('base64');
  }

  return {
    docName: row.doc_name,
    permission: row.permission,
    mimeType,
    content,
    isBase64: !textExts.includes(ext),
    accessCount: row.access_count + 1,
    expiresAt: row.expires_at,
    sharedBy: null, // Do not expose user info to public
  };
}

// ---------------------------------------------------------------------------
// getShareStats
// ---------------------------------------------------------------------------

/**
 * Get sharing statistics for all documents owned by the current user.
 *
 * @returns {Promise<{ totalShares: number, activeShares: number, totalAccesses: number, byDoc: object[] }>}
 */
export async function getShareStats() {
  const user = await requireAuth();
  const db = getDb();

  const rows = db
    .prepare(`SELECT * FROM share_tokens WHERE user_id = ? ORDER BY created_at DESC`)
    .all(user.id);

  const now = nowSec();
  let activeShares = 0;
  let totalAccesses = 0;
  const byDocMap = {};

  for (const row of rows) {
    const isActive =
      !row.revoked &&
      !(row.expires_at && row.expires_at < now) &&
      !(row.max_access && row.access_count >= row.max_access);

    if (isActive) activeShares++;
    totalAccesses += row.access_count;

    if (!byDocMap[row.doc_name]) {
      byDocMap[row.doc_name] = { docName: row.doc_name, shares: 0, accesses: 0, activeShares: 0 };
    }
    byDocMap[row.doc_name].shares++;
    byDocMap[row.doc_name].accesses += row.access_count;
    if (isActive) byDocMap[row.doc_name].activeShares++;
  }

  return {
    totalShares: rows.length,
    activeShares,
    totalAccesses,
    byDoc: Object.values(byDocMap).sort((a, b) => b.accesses - a.accesses),
  };
}
