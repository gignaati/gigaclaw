/**
 * lib/rag/chunker.js — Boundary-Aware Text Chunker
 *
 * Splits documents into overlapping chunks that respect sentence and
 * paragraph boundaries. Designed for local RAG pipelines where chunk
 * quality directly affects retrieval accuracy.
 *
 * Strategy:
 *   1. Split on paragraph boundaries (double newline)
 *   2. If a paragraph exceeds maxTokens, split on sentence boundaries
 *   3. Merge short paragraphs until maxTokens is reached
 *   4. Add overlap by prepending the last `overlapTokens` tokens of the
 *      previous chunk to the current chunk
 *
 * Token estimation: 1 token ≈ 4 chars (conservative, works for English + code)
 */

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 64;
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count for a string.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split text into sentences using common punctuation boundaries.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  // Split on ". ", "! ", "? ", ".\n", "!\n", "?\n"
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

/**
 * Split a single paragraph into sub-chunks if it exceeds maxTokens.
 * @param {string} paragraph
 * @param {number} maxTokens
 * @returns {string[]}
 */
function splitLargeParagraph(paragraph, maxTokens) {
  const sentences = splitSentences(paragraph);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (estimateTokens(candidate) > maxTokens && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [paragraph];
}

/**
 * Chunk a document into overlapping segments.
 *
 * @param {string} text - Full document text
 * @param {Object} [options]
 * @param {number} [options.maxTokens=512] - Max tokens per chunk
 * @param {number} [options.overlapTokens=64] - Overlap tokens between chunks
 * @param {string} [options.source=''] - Source identifier (file path, URL)
 * @returns {Array<{text: string, index: number, source: string, tokenCount: number}>}
 */
export function chunkDocument(text, options = {}) {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    overlapTokens = DEFAULT_OVERLAP_TOKENS,
    source = '',
  } = options;

  if (!text || text.trim().length === 0) return [];

  // Step 1: Split on paragraph boundaries
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);

  // Step 2: Flatten — split large paragraphs into sentence-level sub-chunks
  const segments = [];
  for (const para of paragraphs) {
    if (estimateTokens(para) > maxTokens) {
      segments.push(...splitLargeParagraph(para, maxTokens));
    } else {
      segments.push(para);
    }
  }

  // Step 3: Merge short segments into chunks up to maxTokens
  const rawChunks = [];
  let current = '';

  for (const segment of segments) {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (estimateTokens(candidate) > maxTokens && current) {
      rawChunks.push(current.trim());
      current = segment;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) rawChunks.push(current.trim());

  // Step 4: Add overlap
  const chunks = [];
  for (let i = 0; i < rawChunks.length; i++) {
    let chunkText = rawChunks[i];

    if (i > 0 && overlapTokens > 0) {
      const prevChunk = rawChunks[i - 1];
      const prevChars = overlapTokens * CHARS_PER_TOKEN;
      const overlap = prevChunk.slice(-prevChars);
      chunkText = `${overlap}\n\n${chunkText}`;
    }

    chunks.push({
      text: chunkText,
      index: i,
      source,
      tokenCount: estimateTokens(chunkText),
    });
  }

  return chunks;
}

/**
 * Chunk multiple documents in batch.
 * @param {Array<{text: string, source: string}>} documents
 * @param {Object} [options]
 * @returns {Array<{text: string, index: number, source: string, tokenCount: number, docIndex: number}>}
 */
export function chunkDocuments(documents, options = {}) {
  const allChunks = [];
  for (let docIndex = 0; docIndex < documents.length; docIndex++) {
    const { text, source } = documents[docIndex];
    const chunks = chunkDocument(text, { ...options, source });
    for (const chunk of chunks) {
      allChunks.push({ ...chunk, docIndex });
    }
  }
  return allChunks;
}
