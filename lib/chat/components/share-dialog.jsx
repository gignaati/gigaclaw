/**
 * Share Dialog — Knowledge Base Document Sharing UI (v1.8.1)
 *
 * Provides:
 *   - ShareButton: inline button to open the share dialog for a document
 *   - ShareDialog: modal dialog with:
 *       - Create share link form (permission, expiry, access cap)
 *       - Copy-to-clipboard link display
 *       - Active shares list with revoke controls
 *       - Share statistics summary
 *
 * Design: Brutalist Terminal Manifesto — pure black/white, #00FF41 green accent,
 * Space Grotesk headings, JetBrains Mono for tokens/URLs, DM Sans body.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from '../share-actions.js';

// ---------------------------------------------------------------------------
// Icons (inline SVG to avoid external deps)
// ---------------------------------------------------------------------------

function ShareIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CopyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LinkIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(unixSec) {
  if (!unixSec) return 'Never';
  return new Date(unixSec * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function timeAgo(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2 py-1 border text-xs font-bold transition-colors ${
        copied
          ? 'border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10'
          : 'border-white/30 text-white/70 hover:border-white hover:text-white'
      } ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ShareForm — create a new share link
// ---------------------------------------------------------------------------

function ShareForm({ docPath, docName, onCreated }) {
  const [permission, setPermission] = useState('view');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [maxAccess, setMaxAccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await createShareLink(docPath, {
        permission,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : null,
        maxAccess: maxAccess ? parseInt(maxAccess, 10) : null,
      });
      onCreated(result);
    } catch (err) {
      setError(err.message || 'Failed to create share link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-xs text-white/50 font-mono border-l-2 border-[#00FF41] pl-3">
        SHARING: <span className="text-white">{docName}</span>
      </div>

      {/* Permission */}
      <div>
        <label className="block text-xs font-bold text-white/70 mb-2 tracking-widest">
          PERMISSION
        </label>
        <div className="flex gap-2">
          {['view', 'download'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPermission(p)}
              className={`flex-1 py-2 text-xs font-bold border transition-colors ${
                permission === p
                  ? 'border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10'
                  : 'border-white/20 text-white/50 hover:border-white/50 hover:text-white/80'
              }`}
            >
              {p.toUpperCase()}
              <div className="text-[10px] font-normal mt-0.5 opacity-70">
                {p === 'view' ? 'Read only' : 'Allow download'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Expiry */}
      <div>
        <label className="block text-xs font-bold text-white/70 mb-2 tracking-widest">
          EXPIRES IN
        </label>
        <select
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          className="w-full bg-black border border-white/20 text-white text-xs px-3 py-2 focus:outline-none focus:border-[#00FF41]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <option value="">Never expires</option>
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      </div>

      {/* Max access */}
      <div>
        <label className="block text-xs font-bold text-white/70 mb-2 tracking-widest">
          MAX ACCESSES <span className="text-white/30 font-normal">(optional)</span>
        </label>
        <input
          type="number"
          min="1"
          max="10000"
          placeholder="Unlimited"
          value={maxAccess}
          onChange={(e) => setMaxAccess(e.target.value)}
          className="w-full bg-black border border-white/20 text-white text-xs px-3 py-2 focus:outline-none focus:border-[#00FF41] placeholder-white/20"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-400/30 bg-red-400/5 px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-[#00FF41] text-black text-xs font-bold tracking-widest hover:bg-[#00FF41]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'GENERATING LINK...' : 'GENERATE SHARE LINK'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// NewLinkDisplay — show the freshly created link
// ---------------------------------------------------------------------------

function NewLinkDisplay({ result, onDone }) {
  return (
    <div className="space-y-4">
      <div className="border border-[#00FF41] bg-[#00FF41]/5 p-4">
        <div className="text-xs text-[#00FF41] font-bold tracking-widest mb-3 flex items-center gap-2">
          <CheckIcon size={12} />
          SHARE LINK CREATED
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 text-xs text-white/80 bg-white/5 border border-white/10 px-3 py-2 truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {result.url}
          </div>
          <CopyButton text={result.url} />
        </div>
        {result.expiresAt && (
          <div className="text-[10px] text-white/40 mt-2 font-mono">
            EXPIRES: {formatDate(result.expiresAt)}
          </div>
        )}
      </div>
      <button
        onClick={onDone}
        className="w-full py-2 border border-white/20 text-xs text-white/60 hover:border-white/50 hover:text-white transition-colors"
      >
        CREATE ANOTHER LINK
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShareList — list and revoke existing shares
// ---------------------------------------------------------------------------

function ShareList({ docPath, refreshTrigger }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listShareLinks(docPath);
      setShares(result);
    } catch {
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [docPath]);

  useEffect(() => {
    loadShares();
  }, [loadShares, refreshTrigger]);

  const handleRevoke = async (tokenId) => {
    setRevoking(tokenId);
    try {
      await revokeShareLink(tokenId);
      setShares((prev) =>
        prev.map((s) => (s.id === tokenId ? { ...s, revoked: 1, isActive: false } : s))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-white/30 font-mono py-4 text-center">
        LOADING SHARES...
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <div className="text-xs text-white/30 font-mono py-4 text-center border border-white/10">
        NO ACTIVE SHARE LINKS
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shares.map((share) => (
        <div
          key={share.id}
          className={`border p-3 ${
            share.isActive
              ? 'border-white/20 bg-white/2'
              : 'border-white/10 bg-white/1 opacity-50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Token URL */}
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon size={12} />
                <span
                  className="text-[10px] text-white/60 truncate"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {share.url}
                </span>
                {share.isActive && <CopyButton text={share.url} />}
              </div>

              {/* Metadata row */}
              <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                <span
                  className={`px-1.5 py-0.5 border font-bold ${
                    share.permission === 'download'
                      ? 'border-blue-400/50 text-blue-400'
                      : 'border-white/30 text-white/60'
                  }`}
                >
                  {share.permission.toUpperCase()}
                </span>
                <span className="text-white/40">
                  {share.access_count} ACCESS{share.access_count !== 1 ? 'ES' : ''}
                  {share.max_access ? ` / ${share.max_access}` : ''}
                </span>
                <span className="text-white/40">
                  EXPIRES: {formatDate(share.expires_at)}
                </span>
                <span className="text-white/30">
                  CREATED {timeAgo(share.created_at)}
                </span>
                {share.revoked ? (
                  <span className="text-red-400 font-bold">REVOKED</span>
                ) : share.isExpired ? (
                  <span className="text-orange-400 font-bold">EXPIRED</span>
                ) : share.isExhausted ? (
                  <span className="text-yellow-400 font-bold">EXHAUSTED</span>
                ) : (
                  <span className="text-[#00FF41] font-bold">ACTIVE</span>
                )}
              </div>
            </div>

            {/* Revoke button */}
            {share.isActive && (
              <button
                onClick={() => handleRevoke(share.id)}
                disabled={revoking === share.id}
                className="flex-shrink-0 p-1.5 border border-red-400/30 text-red-400/60 hover:border-red-400 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Revoke this share link"
              >
                {revoking === share.id ? (
                  <span className="text-[10px] font-mono">...</span>
                ) : (
                  <XIcon size={12} />
                )}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShareDialog — main modal
// ---------------------------------------------------------------------------

export function ShareDialog({ docPath, docName, onClose }) {
  const [tab, setTab] = useState('create'); // 'create' | 'manage'
  const [newLink, setNewLink] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreated = (result) => {
    setNewLink(result);
    setRefreshTrigger((n) => n + 1);
  };

  const handleDone = () => {
    setNewLink(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg bg-black border border-white/20 shadow-2xl"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div
              className="text-sm font-bold text-white tracking-widest"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              SHARE DOCUMENT
            </div>
            <div className="text-[10px] text-white/40 font-mono mt-0.5 truncate max-w-xs">
              {docName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 border border-white/20 text-white/50 hover:border-white hover:text-white transition-colors"
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'create', label: 'CREATE LINK' },
            { id: 'manage', label: 'MANAGE LINKS' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-bold tracking-widest transition-colors ${
                tab === t.id
                  ? 'text-[#00FF41] border-b-2 border-[#00FF41]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === 'create' ? (
            newLink ? (
              <NewLinkDisplay result={newLink} onDone={handleDone} />
            ) : (
              <ShareForm docPath={docPath} docName={docName} onCreated={handleCreated} />
            )
          ) : (
            <div>
              <div className="text-xs font-bold text-white/50 tracking-widest mb-3">
                ACTIVE SHARE LINKS
              </div>
              <ShareList docPath={docPath} refreshTrigger={refreshTrigger} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShareButton — inline trigger button for the document table
// ---------------------------------------------------------------------------

export function ShareButton({ docPath, docName }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/20 text-white/60 text-xs font-bold hover:border-[#00FF41] hover:text-[#00FF41] transition-colors"
        title="Share this document"
      >
        <ShareIcon size={12} />
        SHARE
      </button>

      {open && (
        <ShareDialog
          docPath={docPath}
          docName={docName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
