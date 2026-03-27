'use server';
/**
 * Knowledge Base Server Actions — v1.8.0
 *
 * Provides Next.js server actions for the Knowledge Base UI:
 *   - listDocuments()        — list all indexed documents with metadata
 *   - uploadDocument()       — save an uploaded file and trigger ingest
 *   - deleteDocument()       — remove a document and its vectors
 *   - getIngestStatus()      — get per-document ingest status
 *   - ragChat()              — RAG-powered chat with source citations
 *   - getKnowledgeBaseStats() — overall KB stats (docs, chunks, providers)
 */
import { auth } from '../auth/index.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

/** Require authentication — throws if not logged in. */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user;
}

/** Resolve the user's gigaclaw-docs directory. */
function getDocsDir() {
  return path.join(os.homedir(), 'gigaclaw-docs');
}

/** Ensure the docs directory exists. */
function ensureDocsDir() {
  const dir = getDocsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * List all documents currently indexed in the knowledge base.
 * Returns metadata: filename, path, size, chunkCount, indexedAt, status.
 *
 * @returns {Promise<{ documents: object[], totalChunks: number, totalDocs: number }>}
 */
export async function listDocuments() {
  await requireAuth();
  const { getVectorStoreStats, listSources } = await import('../db/vector-store-meta.js').catch(
    async () => {
      // Fallback: derive from rag vector store
      const { getVectorStoreStats } = await import('../rag/vector-store.js');
      return { getVectorStoreStats, listSources: null };
    }
  );

  // Use the RAG index stats as the source of truth
  const { getStats } = await import('../rag/index.js');
  const stats = getStats();

  // Build document list from the docs directory + cross-reference with stats
  const docsDir = getDocsDir();
  const documents = [];

  if (fs.existsSync(docsDir)) {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          const stat = fs.statSync(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          const supported = ['.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm'];
          if (supported.includes(ext)) {
            documents.push({
              id: Buffer.from(fullPath).toString('base64url'),
              filename: entry.name,
              path: fullPath,
              relativePath: path.relative(docsDir, fullPath),
              size: stat.size,
              modifiedAt: stat.mtimeMs,
              ext,
              status: 'indexed', // optimistic — watcher keeps this in sync
            });
          }
        }
      }
    };
    walk(docsDir);
  }

  return {
    documents,
    totalDocs: documents.length,
    totalChunks: stats.totalChunks || 0,
    docsDir,
  };
}

/**
 * Upload a document to the gigaclaw-docs directory and trigger ingest.
 *
 * @param {FormData} formData — must contain a 'file' field
 * @returns {Promise<{ success: boolean, filename: string, chunks: number, error?: string }>}
 */
export async function uploadDocument(formData) {
  await requireAuth();
  const docsDir = ensureDocsDir();

  let file;
  try {
    file = formData.get('file');
  } catch {
    return { success: false, error: 'No file provided in form data.' };
  }

  if (!file || typeof file.name !== 'string') {
    return { success: false, error: 'Invalid file object.' };
  }

  const supported = ['.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm'];
  const ext = path.extname(file.name).toLowerCase();
  if (!supported.includes(ext)) {
    return {
      success: false,
      error: `Unsupported file type: ${ext}. Supported: ${supported.join(', ')}`,
    };
  }

  // Sanitise filename
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-\s]/g, '_');
  const destPath = path.join(docsDir, safeName);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
  } catch (err) {
    return { success: false, error: `Failed to save file: ${err.message}` };
  }

  // Trigger ingest
  try {
    const { ingest } = await import('../rag/index.js');
    const result = await ingest(destPath);
    return {
      success: true,
      filename: safeName,
      path: destPath,
      chunks: result?.chunks || 0,
    };
  } catch (err) {
    // File saved but ingest failed — return partial success
    return {
      success: true,
      filename: safeName,
      path: destPath,
      chunks: 0,
      warning: `File saved but ingest failed: ${err.message}. It will be retried by the watcher.`,
    };
  }
}

/**
 * Delete a document from the knowledge base (removes file + vectors).
 *
 * @param {string} docId — base64url-encoded file path
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteDocument(docId) {
  await requireAuth();

  let filePath;
  try {
    filePath = Buffer.from(docId, 'base64url').toString('utf8');
  } catch {
    return { success: false, error: 'Invalid document ID.' };
  }

  // Security: ensure path is within gigaclaw-docs
  const docsDir = getDocsDir();
  if (!filePath.startsWith(docsDir)) {
    return { success: false, error: 'Path traversal rejected.' };
  }

  // Remove vectors from the knowledge base
  try {
    const { deleteKnowledge } = await import('../rag/index.js');
    await deleteKnowledge(filePath);
  } catch (err) {
    // Non-fatal — continue to file deletion
    console.warn(`[KB] Vector deletion failed for ${filePath}: ${err.message}`);
  }

  // Remove the file
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    return { success: false, error: `Failed to delete file: ${err.message}` };
  }

  return { success: true };
}

/**
 * Re-ingest a specific document (force re-index).
 *
 * @param {string} docId — base64url-encoded file path
 * @returns {Promise<{ success: boolean, chunks: number, error?: string }>}
 */
export async function reindexDocument(docId) {
  await requireAuth();

  let filePath;
  try {
    filePath = Buffer.from(docId, 'base64url').toString('utf8');
  } catch {
    return { success: false, error: 'Invalid document ID.' };
  }

  const docsDir = getDocsDir();
  if (!filePath.startsWith(docsDir)) {
    return { success: false, error: 'Path traversal rejected.' };
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found.' };
  }

  try {
    // Delete existing vectors first
    const { deleteKnowledge, ingest } = await import('../rag/index.js');
    await deleteKnowledge(filePath);
    const result = await ingest(filePath);
    return { success: true, chunks: result?.chunks || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Perform a RAG-powered chat query against the knowledge base.
 * Returns the LLM answer plus the source chunks used as context.
 *
 * @param {string} query — natural language question
 * @param {object} [opts]
 * @param {number} [opts.topK=5] — number of chunks to retrieve
 * @param {string} [opts.conversationId] — optional conversation context
 * @returns {Promise<{ answer: string, sources: object[], query: string, tokensUsed?: number }>}
 */
export async function ragChat(query, opts = {}) {
  await requireAuth();

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { answer: '', sources: [], query, error: 'Empty query.' };
  }

  const { topK = 5 } = opts;

  try {
    const { search, buildRagContext } = await import('../rag/index.js');

    // Retrieve relevant chunks
    const chunks = await search(query, { topK });

    if (!chunks || chunks.length === 0) {
      return {
        answer:
          "I couldn't find relevant information in your knowledge base for that question. Try uploading documents related to your query.",
        sources: [],
        query,
      };
    }

    // Build context string
    const context = buildRagContext(chunks);

    // Call the LLM with the RAG context
    const { chat } = await import('../ai/index.js');
    const systemPrompt = `You are a helpful assistant with access to the user's private knowledge base. 
Answer questions based ONLY on the provided context. If the context doesn't contain enough information to answer the question, say so clearly.
Do not make up information. Cite the source documents when relevant.

CONTEXT FROM KNOWLEDGE BASE:
${context}`;

    const response = await chat({
      messages: [{ role: 'user', content: query }],
      systemPrompt,
      temperature: 0.3,
    });

    // Format sources for display
    const sources = chunks.map((chunk) => ({
      filename: path.basename(chunk.source || 'Unknown'),
      source: chunk.source,
      score: chunk.score,
      preview: chunk.text ? chunk.text.slice(0, 200) + (chunk.text.length > 200 ? '…' : '') : '',
    }));

    return {
      answer: response?.text || response?.content || String(response),
      sources,
      query,
      tokensUsed: response?.usage?.totalTokens,
    };
  } catch (err) {
    return {
      answer: `Knowledge base query failed: ${err.message}`,
      sources: [],
      query,
      error: err.message,
    };
  }
}

/**
 * Get overall knowledge base statistics.
 *
 * @returns {Promise<{ totalDocs: number, totalChunks: number, docsDir: string, watcherActive: boolean }>}
 */
export async function getKnowledgeBaseStats() {
  await requireAuth();
  const { getStats } = await import('../rag/index.js');
  const ragStats = getStats();
  const { documents, docsDir } = await listDocuments();

  return {
    totalDocs: documents.length,
    totalChunks: ragStats.totalChunks || 0,
    docsDir,
    watcherActive: ragStats.watcherActive || false,
    embeddingProvider: ragStats.embeddingProvider || 'ollama',
    vectorStoreType: 'sqlite',
  };
}
