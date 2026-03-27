/**
 * Public Shared Document Viewer — /share/[token]
 *
 * No authentication required. Validates the share token server-side,
 * increments the access count, and renders the document content.
 *
 * Design: Brutalist Terminal Manifesto — black/white, #00FF41 accent,
 * Space Grotesk headings, JetBrains Mono for metadata/tokens.
 */

import { getSharedDocument } from 'gigaclaw/share-actions';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }) {
  try {
    const doc = await getSharedDocument(params.token);
    return {
      title: `${doc.docName} — Shared via GigaClaw`,
      description: 'A document shared from a GigaClaw Knowledge Base.',
      robots: 'noindex, nofollow',
    };
  } catch {
    return {
      title: 'Shared Document — GigaClaw',
      robots: 'noindex, nofollow',
    };
  }
}

// ---------------------------------------------------------------------------
// Error state component
// ---------------------------------------------------------------------------

function ErrorView({ message }) {
  return (
    <div
      className="min-h-screen bg-black text-white flex items-center justify-center p-8"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="max-w-md w-full">
        {/* Brand bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-white flex items-center justify-center">
            <span className="text-black font-black text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>GC</span>
          </div>
          <span className="text-xs font-bold tracking-widest text-white/50">GIGACLAW</span>
        </div>

        <div className="border border-red-400/30 bg-red-400/5 p-6">
          <div className="text-xs font-bold text-red-400 tracking-widest mb-3">ACCESS DENIED</div>
          <p className="text-sm text-white/70">{message}</p>
        </div>

        <div className="mt-6 text-xs text-white/30 font-mono">
          If you believe this is an error, contact the person who shared this link.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document viewer component
// ---------------------------------------------------------------------------

function DocumentViewer({ doc, token }) {
  const isText = !doc.isBase64;
  const isPdf = doc.mimeType === 'application/pdf';

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black font-black text-xs" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>GC</span>
          </div>
          <div>
            <div
              className="text-sm font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {doc.docName}
            </div>
            <div className="text-[10px] text-white/40 font-mono mt-0.5">
              SHARED VIA GIGACLAW · {doc.permission.toUpperCase()} ACCESS
              {doc.expiresAt && ` · EXPIRES ${new Date(doc.expiresAt * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </div>
          </div>
        </div>

        {/* Download button (only if permission allows) */}
        {doc.permission === 'download' && (
          <a
            href={`/api/share/${token}/download`}
            download={doc.docName}
            className="flex items-center gap-2 px-4 py-2 bg-[#00FF41] text-black text-xs font-bold hover:bg-[#00FF41]/90 transition-colors"
          >
            ↓ DOWNLOAD
          </a>
        )}
      </div>

      {/* Access counter strip */}
      <div className="bg-white/3 border-b border-white/5 px-6 py-2 flex items-center gap-4 text-[10px] font-mono text-white/30">
        <span>ACCESS #{doc.accessCount}</span>
        <span>·</span>
        <span className="text-[#00FF41]">● SECURE LOCAL DOCUMENT</span>
        <span>·</span>
        <span>POWERED BY GIGACLAW KNOWLEDGE BASE</span>
      </div>

      {/* Document content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {isPdf ? (
          /* PDF: show base64 embed */
          <div className="border border-white/10">
            <iframe
              src={`data:application/pdf;base64,${doc.content}`}
              className="w-full"
              style={{ height: '80vh' }}
              title={doc.docName}
            />
          </div>
        ) : isText ? (
          /* Text/Markdown/HTML: render as pre-formatted text */
          <div className="border border-white/10 bg-white/2">
            <div className="border-b border-white/10 px-4 py-2 flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                {doc.mimeType}
              </span>
            </div>
            <pre
              className="p-6 text-sm text-white/80 overflow-x-auto whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}
            >
              {doc.content}
            </pre>
          </div>
        ) : (
          /* Binary non-PDF: offer download only */
          <div className="border border-white/10 bg-white/2 p-8 text-center">
            <div className="text-4xl mb-4">📄</div>
            <div className="text-sm text-white/70 mb-2">{doc.docName}</div>
            <div className="text-xs text-white/40 font-mono mb-6">{doc.mimeType}</div>
            {doc.permission === 'download' ? (
              <a
                href={`/api/share/${token}/download`}
                download={doc.docName}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#00FF41] text-black text-xs font-bold hover:bg-[#00FF41]/90 transition-colors"
              >
                ↓ DOWNLOAD FILE
              </a>
            ) : (
              <div className="text-xs text-white/30 font-mono">
                PREVIEW NOT AVAILABLE FOR THIS FILE TYPE
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-6 py-4 text-center">
        <div className="text-[10px] text-white/20 font-mono">
          This document was shared using{' '}
          <a href="https://gignaati.com/gigaclaw" className="text-white/40 hover:text-white/60 underline">
            GigaClaw
          </a>{' '}
          — Your Personal AI, Without the Cloud Bill.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default async function SharedDocumentPage({ params }) {
  const { token } = params;

  let doc;
  try {
    doc = await getSharedDocument(token);
  } catch (err) {
    return <ErrorView message={err.message || 'This share link is invalid or has expired.'} />;
  }

  return <DocumentViewer doc={doc} token={token} />;
}
