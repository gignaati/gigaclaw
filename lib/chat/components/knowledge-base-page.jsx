'use client';
/**
 * Knowledge Base Page — v1.8.0
 *
 * Design: Brutalist Terminal Manifesto — pure black/white, #00FF41 green accent,
 * Space Grotesk headings, JetBrains Mono for code/badges, DM Sans for body.
 * No external chart libraries. Sharp borders, no rounded corners.
 *
 * Sections:
 *   1. Stats Bar — total docs, total chunks, docs dir, watcher status
 *   2. Upload Zone — drag-and-drop + file picker, progress indicator
 *   3. Document Table — filename, size, chunks, status, actions (reindex, delete)
 *   4. RAG Chat Panel — context-aware chat with source citations
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { PageLayout } from './page-layout.js';
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  reindexDocument,
  ragChat,
  getKnowledgeBaseStats,
} from '../knowledge-base-actions.js';

// ─── Icons (inline SVG to avoid new icon deps) ────────────────────────────────
function BookIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function UploadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}
function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function RefreshIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
function SendIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function FileIcon({ ext = '' }) {
  const colors = { pdf: '#FF4444', docx: '#2B7BF5', doc: '#2B7BF5', md: '#00FF41', txt: '#aaa', html: '#FF8C00', htm: '#FF8C00' };
  const color = colors[ext.replace('.', '')] || '#888';
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color, border: `1px solid ${color}`, padding: '1px 4px', borderRadius: 0, letterSpacing: 1 }}>
      {ext.replace('.', '').toUpperCase() || 'FILE'}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-border bg-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-background p-4 animate-pulse">
            <div className="h-6 w-12 bg-muted rounded-none mb-1" />
            <div className="h-3 w-20 bg-muted/50 rounded-none" />
          </div>
        ))}
      </div>
    );
  }
  const items = [
    { value: stats?.totalDocs ?? 0, label: 'DOCUMENTS', accent: true },
    { value: stats?.totalChunks ?? 0, label: 'INDEXED CHUNKS', accent: false },
    { value: stats?.embeddingProvider?.toUpperCase() ?? 'OLLAMA', label: 'EMBEDDING ENGINE', accent: false },
    { value: stats?.watcherActive ? 'ACTIVE' : 'IDLE', label: 'AUTO-WATCHER', accent: stats?.watcherActive },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-border bg-border">
      {items.map((item) => (
        <div key={item.label} className="bg-background p-4">
          <div
            className="text-2xl font-bold"
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              color: item.accent ? '#00FF41' : 'var(--foreground)',
            }}
          >
            {item.value}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ onUploadComplete }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    const results = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const result = await uploadDocument(fd);
        results.push({ filename: file.name, ...result });
      } catch (err) {
        results.push({ filename: file.name, success: false, error: err.message });
      }
    }
    setUploading(false);
    setUploadResult(results);
    onUploadComplete?.();
  }, [onUploadComplete]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragging ? '#00FF41' : 'var(--border)',
          background: dragging ? 'rgba(0,255,65,0.04)' : 'transparent',
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.html,.htm"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <UploadIcon size={32} />
          {uploading ? (
            <div className="space-y-1">
              <div className="text-sm font-mono text-green-400 animate-pulse">Ingesting documents…</div>
              <div className="text-xs text-muted-foreground">Chunking, embedding, indexing into vector store</div>
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Drop files here or click to upload
              </div>
              <div className="text-xs text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                PDF · DOCX · TXT · MD · HTML — max 50 MB per file
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Or drop files into{' '}
                <code className="text-green-400 bg-muted px-1">~/gigaclaw-docs/</code>{' '}
                — auto-ingested by the watcher
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload results */}
      {uploadResult && uploadResult.length > 0 && (
        <div className="border border-border divide-y divide-border">
          {uploadResult.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: r.success ? '#00FF41' : '#FF4444' }}
              />
              <span className="flex-1 font-mono text-xs truncate">{r.filename}</span>
              {r.success ? (
                <span className="text-green-400 text-xs font-mono">{r.chunks} chunks indexed</span>
              ) : (
                <span className="text-red-400 text-xs font-mono">{r.error}</span>
              )}
              {r.warning && (
                <span className="text-yellow-400 text-xs font-mono ml-2">{r.warning}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Document Table ───────────────────────────────────────────────────────────
function DocumentTable({ documents, loading, onDelete, onReindex }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const handleDelete = async (doc) => {
    if (confirmDelete === doc.id) {
      setActionLoading(doc.id + '_delete');
      await onDelete(doc.id);
      setConfirmDelete(null);
      setActionLoading(null);
    } else {
      setConfirmDelete(doc.id);
    }
  };

  const handleReindex = async (doc) => {
    setActionLoading(doc.id + '_reindex');
    await onReindex(doc.id);
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="border border-border divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
            <div className="h-4 w-12 bg-muted rounded-none" />
            <div className="h-4 flex-1 bg-muted/70 rounded-none" />
            <div className="h-4 w-16 bg-muted/50 rounded-none" />
          </div>
        ))}
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="border border-border p-8 text-center">
        <BookIcon size={32} />
        <div className="mt-3 text-sm text-muted-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          No documents indexed yet
        </div>
        <div className="mt-1 text-xs text-muted-foreground font-mono">
          Upload files above or drop them into{' '}
          <code className="text-green-400">~/gigaclaw-docs/</code>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2 text-xs font-mono text-muted-foreground tracking-widest">TYPE</th>
            <th className="text-left px-4 py-2 text-xs font-mono text-muted-foreground tracking-widest">FILENAME</th>
            <th className="text-left px-4 py-2 text-xs font-mono text-muted-foreground tracking-widest hidden md:table-cell">SIZE</th>
            <th className="text-left px-4 py-2 text-xs font-mono text-muted-foreground tracking-widest hidden md:table-cell">MODIFIED</th>
            <th className="text-left px-4 py-2 text-xs font-mono text-muted-foreground tracking-widest">STATUS</th>
            <th className="text-right px-4 py-2 text-xs font-mono text-muted-foreground tracking-widest">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <FileIcon ext={doc.ext} />
              </td>
              <td className="px-4 py-3">
                <div className="font-mono text-xs truncate max-w-[200px] md:max-w-[320px]" title={doc.filename}>
                  {doc.filename}
                </div>
                {doc.relativePath !== doc.filename && (
                  <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    {doc.relativePath}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs font-mono text-muted-foreground">{formatBytes(doc.size)}</span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs font-mono text-muted-foreground">{timeAgo(doc.modifiedAt)}</span>
              </td>
              <td className="px-4 py-3">
                <span
                  className="text-xs font-mono px-2 py-0.5 border"
                  style={{
                    color: doc.status === 'indexed' ? '#00FF41' : '#FF8C00',
                    borderColor: doc.status === 'indexed' ? '#00FF41' : '#FF8C00',
                  }}
                >
                  {doc.status?.toUpperCase() || 'INDEXED'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {/* Reindex */}
                  <button
                    onClick={() => handleReindex(doc)}
                    disabled={actionLoading === doc.id + '_reindex'}
                    className="p-1.5 border border-border hover:border-foreground transition-colors disabled:opacity-40"
                    title="Re-index document"
                  >
                    <RefreshIcon size={13} />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={actionLoading === doc.id + '_delete'}
                    className="p-1.5 border transition-colors disabled:opacity-40"
                    style={{
                      borderColor: confirmDelete === doc.id ? '#FF4444' : 'var(--border)',
                      color: confirmDelete === doc.id ? '#FF4444' : 'inherit',
                    }}
                    title={confirmDelete === doc.id ? 'Click again to confirm delete' : 'Delete document'}
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── RAG Chat Panel ───────────────────────────────────────────────────────────
function RagChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: query, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const result = await ragChat(query, { topK: 5 });
      const assistantMsg = {
        role: 'assistant',
        content: result.answer,
        sources: result.sources || [],
        error: result.error,
        id: Date.now() + 1,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}`, sources: [], id: Date.now() + 1 },
      ]);
    }
    setLoading(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="border border-border flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs font-mono tracking-widest text-muted-foreground">RAG CHAT — KNOWLEDGE BASE QUERY</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
            <BookIcon size={28} />
            <div className="text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Ask anything about your documents
            </div>
            <div className="text-xs font-mono space-y-1">
              <div>"Summarise the key points from the Q4 report"</div>
              <div>"What are the API rate limits mentioned in the docs?"</div>
              <div>"Find all mentions of data privacy policies"</div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="max-w-[85%] px-4 py-3 text-sm leading-relaxed"
              style={{
                background: msg.role === 'user' ? '#00FF41' : 'var(--muted)',
                color: msg.role === 'user' ? '#000' : 'var(--foreground)',
                fontFamily: 'DM Sans, sans-serif',
                borderRadius: 0,
              }}
            >
              {msg.content}
            </div>

            {/* Source citations */}
            {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
              <div className="max-w-[85%] space-y-1">
                <div className="text-xs font-mono text-muted-foreground tracking-widest">SOURCES</div>
                {msg.sources.map((src, i) => (
                  <div key={i} className="border border-border px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <FileIcon ext={'.' + (src.filename?.split('.').pop() || 'txt')} />
                      <span className="font-mono text-xs truncate">{src.filename}</span>
                      <span className="ml-auto text-muted-foreground font-mono">
                        score: {src.score?.toFixed(3) || 'n/a'}
                      </span>
                    </div>
                    {src.preview && (
                      <div className="text-muted-foreground leading-relaxed line-clamp-2">{src.preview}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="px-4 py-3 border border-border text-sm font-mono text-green-400 animate-pulse">
              Searching knowledge base…
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border flex items-end gap-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question about your documents… (Enter to send)"
          rows={2}
          className="flex-1 bg-transparent px-4 py-3 text-sm resize-none outline-none placeholder:text-muted-foreground"
          style={{ fontFamily: 'DM Sans, sans-serif', borderRadius: 0 }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="px-4 py-3 h-full border-l border-border transition-colors disabled:opacity-40"
          style={{
            background: input.trim() && !loading ? '#00FF41' : 'transparent',
            color: input.trim() && !loading ? '#000' : 'var(--muted-foreground)',
          }}
        >
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function KnowledgeBasePage({ session }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'chat'

  const loadStats = useCallback(async () => {
    try {
      const s = await getKnowledgeBaseStats();
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const { documents: docs } = await listDocuments();
      setDocuments(docs || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadDocuments();
  }, [loadStats, loadDocuments]);

  const handleDelete = async (docId) => {
    await deleteDocument(docId);
    await Promise.all([loadDocuments(), loadStats()]);
  };

  const handleReindex = async (docId) => {
    await reindexDocument(docId);
    await loadStats();
  };

  const handleUploadComplete = () => {
    loadDocuments();
    loadStats();
  };

  return (
    <PageLayout session={session}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookIcon size={18} />
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Knowledge Base
              </h1>
            </div>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Upload documents and query them with RAG — 100% on-device, zero data egress.
            </p>
            {stats?.docsDir && (
              <div className="mt-1 text-xs font-mono text-muted-foreground">
                Auto-watch:{' '}
                <code className="text-green-400">{stats.docsDir}</code>
              </div>
            )}
          </div>
          <button
            onClick={() => { loadDocuments(); loadStats(); }}
            className="p-2 border border-border hover:border-foreground transition-colors flex-shrink-0"
            title="Refresh"
          >
            <RefreshIcon size={14} />
          </button>
        </div>

        {/* Stats bar */}
        <StatsBar stats={stats} loading={statsLoading} />

        {/* Upload zone */}
        <div>
          <div className="text-xs font-mono tracking-widest text-muted-foreground mb-3">
            // UPLOAD DOCUMENTS
          </div>
          <UploadZone onUploadComplete={handleUploadComplete} />
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border">
          {[
            { id: 'documents', label: 'DOCUMENTS' },
            { id: 'chat', label: 'RAG CHAT' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-6 py-2 text-xs font-mono tracking-widest transition-colors border-b-2"
              style={{
                borderBottomColor: activeTab === tab.id ? '#00FF41' : 'transparent',
                color: activeTab === tab.id ? '#00FF41' : 'var(--muted-foreground)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'documents' && (
          <div>
            <div className="text-xs font-mono tracking-widest text-muted-foreground mb-3">
              // INDEXED DOCUMENTS ({docsLoading ? '…' : documents.length})
            </div>
            <DocumentTable
              documents={documents}
              loading={docsLoading}
              onDelete={handleDelete}
              onReindex={handleReindex}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <div className="text-xs font-mono tracking-widest text-muted-foreground mb-3">
              // RAG-POWERED CHAT — CONTEXT FROM YOUR DOCUMENTS
            </div>
            <RagChatPanel />
          </div>
        )}
      </div>
    </PageLayout>
  );
}
