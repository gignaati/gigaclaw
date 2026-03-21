'use client';
/**
 * Trust Ledger — Data Egress Visibility Panel + Audit Log
 *
 * Design: Brutalist terminal aesthetic — pure black/white, monospace, sharp borders.
 * No external chart libraries — bar charts rendered with pure CSS/SVG.
 *
 * Sections:
 *   1. Chain Integrity Banner — pass/fail status of the hash chain
 *   2. Data Egress Visibility Panel — token aggregation by provider, local vs cloud ratio
 *   3. Audit Log Table — filterable, paginated, expandable rows
 *   4. Export Button — downloads signed JSON
 */

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from './page-layout.js';
import { ShieldIcon, DownloadIcon } from './icons.js';
import {
  getAuditLogEntries,
  verifyAuditChain,
  getEgressSummary,
  exportAuditLog,
} from '../trust-ledger-actions.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString();
}

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ACTION_TYPE_LABELS = {
  llm_call: 'LLM Call',
  shell_exec: 'Shell Exec',
  file_write: 'File Write',
  webhook_post: 'Webhook',
  telegram_send: 'Telegram',
  job_create: 'Job Create',
};

const ACTION_TYPE_COLORS = {
  llm_call: 'text-emerald-400',
  shell_exec: 'text-yellow-400',
  file_write: 'text-blue-400',
  webhook_post: 'text-purple-400',
  telegram_send: 'text-sky-400',
  job_create: 'text-orange-400',
};

// ─── Chain Integrity Banner ───────────────────────────────────────────────────

function ChainBanner({ chainStatus }) {
  if (!chainStatus) {
    return (
      <div className="border border-border rounded-none p-4 flex items-center gap-3 bg-muted/30 animate-pulse">
        <div className="h-4 w-4 rounded-full bg-border" />
        <span className="text-sm text-muted-foreground font-mono">Verifying chain integrity…</span>
      </div>
    );
  }

  if (chainStatus.intact) {
    return (
      <div className="border border-emerald-500/60 rounded-none p-4 flex items-center justify-between bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✓</span>
          <div>
            <span className="text-sm font-mono font-semibold text-emerald-400">CHAIN INTACT</span>
            <span className="text-sm font-mono text-muted-foreground ml-3">
              {chainStatus.totalEntries.toLocaleString()} entries verified
            </span>
          </div>
        </div>
        <span className="text-xs font-mono text-muted-foreground hidden sm:block">
          SHA-256 hash chain · tamper-evident
        </span>
      </div>
    );
  }

  return (
    <div className="border border-destructive rounded-none p-4 flex items-center justify-between bg-destructive/10">
      <div className="flex items-center gap-3">
        <span className="text-destructive text-lg">⚠</span>
        <div>
          <span className="text-sm font-mono font-semibold text-destructive">CHAIN BROKEN</span>
          <span className="text-sm font-mono text-muted-foreground ml-3">
            Entry {chainStatus.brokenAt} modified · {chainStatus.reason}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Data Egress Visibility Panel ─────────────────────────────────────────────

function EgressBar({ label, tokens, maxTokens, isLocal }) {
  const pct = maxTokens > 0 ? Math.max(2, Math.round((tokens / maxTokens) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-48 shrink-0 text-xs font-mono text-muted-foreground truncate">{label}</div>
      <div className="flex-1 bg-border/30 h-5 relative overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${isLocal ? 'bg-emerald-500' : 'bg-muted-foreground/60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-20 text-right text-xs font-mono text-foreground shrink-0">
        {formatTokens(tokens)}
      </div>
      <div className="w-16 text-right text-xs font-mono shrink-0">
        {isLocal ? (
          <span className="text-emerald-400">LOCAL</span>
        ) : (
          <span className="text-muted-foreground">CLOUD</span>
        )}
      </div>
    </div>
  );
}

function EgressPanel({ egress, days, onDaysChange }) {
  if (!egress) {
    return (
      <div className="border border-border p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse bg-border/30 rounded-none" />
        ))}
      </div>
    );
  }

  const maxTokens = Math.max(...egress.providers.map((p) => p.tokensIn + p.tokensOut), 1);

  return (
    <div className="border border-border rounded-none">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-foreground tracking-widest uppercase">
            Data Egress Summary
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            — last {days} days
          </span>
        </div>
        {/* Day selector */}
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`px-2 py-0.5 text-xs font-mono border transition-colors ${
                days === d
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Ratio summary row */}
      <div className="flex items-center gap-6 px-4 py-3 border-b border-border bg-muted/10">
        {/* Local ratio */}
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-emerald-500 shrink-0" />
          <span className="text-xs font-mono">
            <span className="text-emerald-400 font-bold">{egress.localRatio}%</span>
            <span className="text-muted-foreground ml-1">local</span>
          </span>
        </div>
        {/* Cloud ratio */}
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-muted-foreground/60 shrink-0" />
          <span className="text-xs font-mono">
            <span className="text-foreground font-bold">{egress.cloudRatio}%</span>
            <span className="text-muted-foreground ml-1">cloud</span>
          </span>
        </div>
        {/* Total */}
        <div className="ml-auto text-xs font-mono text-muted-foreground">
          {formatTokens(egress.totalTokens)} total tokens · {egress.totalCalls} calls
        </div>
      </div>

      {/* Ratio bar (full width) */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex h-4 overflow-hidden bg-border/30">
          <div
            className="bg-emerald-500 h-full transition-all duration-700"
            style={{ width: `${egress.localRatio}%` }}
            title={`Local: ${egress.localRatio}%`}
          />
          <div
            className="bg-muted-foreground/50 h-full transition-all duration-700"
            style={{ width: `${egress.cloudRatio}%` }}
            title={`Cloud: ${egress.cloudRatio}%`}
          />
        </div>
      </div>

      {/* Per-provider bars */}
      <div className="px-4 py-2">
        {egress.providers.length === 0 ? (
          <p className="text-xs font-mono text-muted-foreground py-4 text-center">
            No LLM calls recorded in the last {days} days.
          </p>
        ) : (
          egress.providers.map((p) => (
            <EgressBar
              key={p.provider}
              label={p.label}
              tokens={p.tokensIn + p.tokensOut}
              maxTokens={maxTokens}
              isLocal={p.isLocal}
            />
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-border bg-muted/10">
        <p className="text-[11px] font-mono text-muted-foreground">
          Token counts are estimated (1 token ≈ 4 chars). Prompt content is never stored.
          <span className="text-emerald-400 ml-2">■ Local</span>
          <span className="text-muted-foreground ml-2">■ Cloud</span>
        </p>
      </div>
    </div>
  );
}

// ─── Audit Log Table ──────────────────────────────────────────────────────────

function LogRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = ACTION_TYPE_COLORS[entry.actionType] || 'text-foreground';
  const typeLabel = ACTION_TYPE_LABELS[entry.actionType] || entry.actionType;

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
          {timeAgo(entry.timestamp)}
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs font-mono font-semibold ${typeColor}`}>{typeLabel}</span>
        </td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{entry.actor}</td>
        <td className="px-3 py-2 text-xs font-mono text-foreground truncate max-w-xs">{entry.target}</td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground truncate max-w-sm hidden lg:table-cell">
          {entry.summary}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground/40 hidden xl:table-cell">
          {entry.entryHash?.slice(0, 8)}…
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground/40">
          <span className={expanded ? 'rotate-90 inline-block transition-transform' : 'inline-block transition-transform'}>▶</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={7} className="px-4 py-3">
            <div className="space-y-2">
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">Timestamp:</span> {formatTimestamp(entry.timestamp)}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">Summary:</span> {entry.summary}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">Entry Hash:</span> {entry.entryHash}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-foreground">Prev Hash:</span> {entry.prevHash}
              </div>
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div>
                  <span className="text-xs font-mono text-foreground">Metadata:</span>
                  <pre className="mt-1 text-xs font-mono text-muted-foreground bg-background border border-border p-2 overflow-x-auto">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LogTable({ entries, loading, total, page, onPageChange, filterType, onFilterType }) {
  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="border border-border rounded-none">
      {/* Table header with filters */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-mono font-semibold text-foreground tracking-widest uppercase">
          Audit Log
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">Filter:</span>
          <select
            value={filterType}
            onChange={(e) => { onFilterType(e.target.value); onPageChange(0); }}
            className="text-xs font-mono bg-background border border-border px-2 py-1 text-foreground focus:outline-none focus:border-foreground"
          >
            <option value="">All types</option>
            {Object.entries(ACTION_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <span className="text-xs font-mono text-muted-foreground ml-2">{total.toLocaleString()} entries</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="px-3 py-2 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-wider">When</th>
              <th className="px-3 py-2 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-3 py-2 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Actor</th>
              <th className="px-3 py-2 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Target</th>
              <th className="px-3 py-2 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Summary</th>
              <th className="px-3 py-2 text-left text-[11px] font-mono text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Hash</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={7} className="px-3 py-3">
                    <div className="h-4 animate-pulse bg-border/30 rounded-none" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">
                  No audit log entries yet. Actions will appear here as your agent runs.
                </td>
              </tr>
            ) : (
              entries.map((entry) => <LogRow key={entry.id} entry={entry} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className="text-xs font-mono px-3 py-1 border border-border disabled:opacity-30 hover:border-foreground transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            className="text-xs font-mono px-3 py-1 border border-border disabled:opacity-30 hover:border-foreground transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TrustLedgerPage({ session }) {
  const PAGE_SIZE = 50;

  // Chain integrity
  const [chainStatus, setChainStatus] = useState(null);

  // Egress panel
  const [egress, setEgress] = useState(null);
  const [egressDays, setEgressDays] = useState(30);

  // Log table
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [logLoading, setLogLoading] = useState(true);

  // Export
  const [exporting, setExporting] = useState(false);

  // Load chain integrity on mount
  useEffect(() => {
    verifyAuditChain()
      .then(setChainStatus)
      .catch(() => setChainStatus({ intact: false, totalEntries: 0, reason: 'verification failed' }));
  }, []);

  // Load egress summary when days changes
  useEffect(() => {
    setEgress(null);
    getEgressSummary(egressDays)
      .then(setEgress)
      .catch(() => setEgress({ providers: [], totalTokens: 0, localRatio: 0, cloudRatio: 0, totalCalls: 0, days: egressDays }));
  }, [egressDays]);

  // Load log entries when page or filter changes
  const loadEntries = useCallback(async () => {
    setLogLoading(true);
    try {
      const { entries: e, total: t } = await getAuditLogEntries({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        actionType: filterType || undefined,
      });
      setEntries(e);
      setTotal(t);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLogLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Export handler
  async function handleExport() {
    setExporting(true);
    try {
      const json = await exportAuditLog();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gigaclaw-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageLayout session={session}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldIcon size={20} />
          <div>
            <h1 className="text-xl font-semibold font-mono">Trust Ledger</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Tamper-evident audit log · Data egress visibility · SHA-256 hash chain
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono border border-border hover:border-foreground hover:text-foreground text-muted-foreground transition-colors disabled:opacity-50"
        >
          <DownloadIcon size={14} />
          {exporting ? 'Exporting…' : 'Export JSON'}
        </button>
      </div>

      {/* Chain integrity banner */}
      <div className="mb-6">
        <ChainBanner chainStatus={chainStatus} />
      </div>

      {/* Data Egress Visibility Panel */}
      <div className="mb-6">
        <EgressPanel egress={egress} days={egressDays} onDaysChange={setEgressDays} />
      </div>

      {/* Audit Log Table */}
      <LogTable
        entries={entries}
        loading={logLoading}
        total={total}
        page={page}
        onPageChange={setPage}
        filterType={filterType}
        onFilterType={setFilterType}
      />
    </PageLayout>
  );
}
