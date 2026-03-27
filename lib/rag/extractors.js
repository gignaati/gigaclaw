/**
 * lib/rag/extractors.js — Document Text Extractors
 *
 * Extracts plain text from various file formats for RAG ingestion.
 * All extractors return { text: string, metadata: Object }.
 *
 * Supported formats:
 *   .txt, .md, .mdx, .rst  — plain text (no dependency)
 *   .html, .htm            — HTML stripping (no dependency)
 *   .pdf                   — pdf-parse (optional, graceful fallback)
 *   .docx                  — mammoth (optional, graceful fallback)
 *   .json                  — JSON stringification
 *   .csv                   — CSV as plain text
 *   .js, .ts, .py, etc.    — code files as plain text
 */

import fs from 'fs';
import path from 'path';

/**
 * Strip HTML tags and decode common entities.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extract text from a plain text / Markdown file.
 * @param {string} filePath
 * @returns {Promise<{text: string, metadata: Object}>}
 */
export async function extractText(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return {
    text,
    metadata: { format: 'text', filePath, size: text.length },
  };
}

/**
 * Extract text from an HTML file.
 * @param {string} filePath
 * @returns {Promise<{text: string, metadata: Object}>}
 */
export async function extractHtml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const text = stripHtml(raw);
  return {
    text,
    metadata: { format: 'html', filePath, size: text.length },
  };
}

/**
 * Extract text from a PDF file using pdf-parse.
 * Falls back to a stub if pdf-parse is not installed.
 * @param {string} filePath
 * @returns {Promise<{text: string, metadata: Object}>}
 */
export async function extractPdf(filePath) {
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      metadata: {
        format: 'pdf',
        filePath,
        pages: data.numpages,
        size: data.text.length,
      },
    };
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      console.warn(`[RAG] pdf-parse not installed — skipping ${path.basename(filePath)}. Run: npm install pdf-parse`);
      return { text: '', metadata: { format: 'pdf', filePath, error: 'pdf-parse not installed' } };
    }
    throw err;
  }
}

/**
 * Extract text from a DOCX file using mammoth.
 * Falls back to a stub if mammoth is not installed.
 * @param {string} filePath
 * @returns {Promise<{text: string, metadata: Object}>}
 */
export async function extractDocx(filePath) {
  try {
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
      metadata: {
        format: 'docx',
        filePath,
        size: result.value.length,
        warnings: result.messages.length,
      },
    };
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      console.warn(`[RAG] mammoth not installed — skipping ${path.basename(filePath)}. Run: npm install mammoth`);
      return { text: '', metadata: { format: 'docx', filePath, error: 'mammoth not installed' } };
    }
    throw err;
  }
}

/**
 * Extract text from a JSON file.
 * @param {string} filePath
 * @returns {Promise<{text: string, metadata: Object}>}
 */
export async function extractJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let text = raw;
  try {
    const parsed = JSON.parse(raw);
    text = JSON.stringify(parsed, null, 2);
  } catch {
    // Use raw text if JSON is malformed
  }
  return {
    text,
    metadata: { format: 'json', filePath, size: text.length },
  };
}

/**
 * Route a file to the correct extractor based on its extension.
 * @param {string} filePath
 * @returns {Promise<{text: string, metadata: Object}>}
 */
export async function extractFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractPdf(filePath);
    case '.docx':
    case '.doc':
      return extractDocx(filePath);
    case '.html':
    case '.htm':
      return extractHtml(filePath);
    case '.json':
      return extractJson(filePath);
    case '.txt':
    case '.md':
    case '.mdx':
    case '.rst':
    case '.csv':
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
    case '.py':
    case '.sh':
    case '.yaml':
    case '.yml':
    case '.toml':
    case '.env':
      return extractText(filePath);
    default:
      // Attempt plain text extraction for unknown types
      try {
        return await extractText(filePath);
      } catch {
        return {
          text: '',
          metadata: { format: 'unknown', filePath, error: `Unsupported extension: ${ext}` },
        };
      }
  }
}

/**
 * Supported file extensions for RAG ingestion.
 */
export const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.html', '.htm', '.json',
  '.txt', '.md', '.mdx', '.rst', '.csv',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.sh',
  '.yaml', '.yml', '.toml',
]);

/**
 * Check if a file is supported for RAG ingestion.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}
