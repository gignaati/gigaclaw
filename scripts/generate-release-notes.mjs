#!/usr/bin/env node
/**
 * generate-release-notes.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates structured release notes for a Giga Bot version tag.
 *
 * Usage (local):
 *   node scripts/generate-release-notes.mjs [--from <prev-tag>] [--to <current-tag>]
 *
 * Usage (CI — called by .github/workflows/publish-npm.yml):
 *   Reads FROM_TAG / TO_TAG / ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / MODEL
 *   from environment variables and writes output to stdout (redirect to file).
 *
 * Output format:
 *   Markdown suitable for GitHub Releases and CHANGELOG.md
 *
 * Requires: Node.js 18+ (uses native fetch)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { parseArgs } from 'util';

// ── CLI argument parsing ─────────────────────────────────────────────────────
const { values: argv } = parseArgs({
  options: {
    from:   { type: 'string', short: 'f' },
    to:     { type: 'string', short: 't' },
    output: { type: 'string', short: 'o' },
    help:   { type: 'boolean', short: 'h' },
  },
  strict: false,
});

if (argv.help) {
  console.log(`
Usage: node scripts/generate-release-notes.mjs [options]

Options:
  -f, --from <tag>     Previous tag to compare from (auto-detected if omitted)
  -t, --to <tag>       Current tag to compare to (defaults to HEAD / latest tag)
  -o, --output <file>  Write output to file instead of stdout
  -h, --help           Show this help

Environment variables:
  FROM_TAG             Overrides --from
  TO_TAG               Overrides --to
  ANTHROPIC_API_KEY    Enables LLM-powered narrative summary (optional)
  ANTHROPIC_BASE_URL   Defaults to https://api.anthropic.com
  MODEL                Anthropic model ID (defaults to claude-3-5-haiku-20241022)
`);
  process.exit(0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function detectCurrentTag() {
  const tag = git('describe --tags --exact-match HEAD 2>/dev/null') ||
              git('tag --sort=-version:refname | head -1');
  return tag || null;
}

function detectPreviousTag(currentTag, isPrerelease) {
  const allTags = git('tag --sort=-version:refname')
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => t !== currentTag);

  if (isPrerelease) {
    return allTags[0] || null;
  }
  // For stable releases, skip pre-release tags
  return allTags.find(t => !t.includes('-')) || null;
}

/**
 * Parse conventional commit subjects into typed buckets.
 * Returns { feats, fixes, docs, perf, breaks, other }
 */
function parseCommits(commits) {
  const buckets = { feats: [], fixes: [], docs: [], perf: [], breaks: [], other: [] };

  for (const { subject, hash, repo } of commits) {
    const shortHash = hash.slice(0, 7);
    const link = `[\`${shortHash}\`](https://github.com/${repo}/commit/${hash})`;

    // Strip conventional commit prefix for display
    const display = subject
      .replace(/^[a-z]+\([^)]*\)!?:\s*/i, '')
      .replace(/^[a-z]+!?:\s*/i, '');

    const entry = `- ${display} ${link}`;

    if (/BREAKING.CHANGE/i.test(subject) || /^[a-z]+(\([^)]*\))?!:/i.test(subject)) {
      buckets.breaks.push(entry);
    } else if (/^(feat|feature)(\([^)]*\))?:/i.test(subject)) {
      buckets.feats.push(entry);
    } else if (/^fix(\([^)]*\))?:/i.test(subject)) {
      buckets.fixes.push(entry);
    } else if (/^docs?(\([^)]*\))?:/i.test(subject)) {
      buckets.docs.push(entry);
    } else if (/^perf(\([^)]*\))?:/i.test(subject)) {
      buckets.perf.push(entry);
    } else if (/^(chore|build|ci|refactor|style|test)(\([^)]*\))?:/i.test(subject)) {
      // Skip internal maintenance commits from user-facing notes
    } else {
      buckets.other.push(entry);
    }
  }

  return buckets;
}

/**
 * Build the structured markdown body from commit buckets.
 */
function buildStructuredNotes(version, buckets) {
  const sections = [];

  if (buckets.breaks.length) {
    sections.push(`### ⚠️ Breaking Changes\n\n${buckets.breaks.join('\n')}`);
  }
  if (buckets.feats.length) {
    sections.push(`### ✨ New Features\n\n${buckets.feats.join('\n')}`);
  }
  if (buckets.fixes.length) {
    sections.push(`### 🐛 Bug Fixes\n\n${buckets.fixes.join('\n')}`);
  }
  if (buckets.perf.length) {
    sections.push(`### ⚡ Performance\n\n${buckets.perf.join('\n')}`);
  }
  if (buckets.docs.length) {
    sections.push(`### 📖 Documentation\n\n${buckets.docs.join('\n')}`);
  }
  if (buckets.other.length) {
    sections.push(`### 🔧 Other Changes\n\n${buckets.other.join('\n')}`);
  }

  if (sections.length === 0) {
    return `### 🔧 Other Changes\n\n- Bug fixes and improvements.`;
  }

  return `## What's Changed in v${version}\n\n${sections.join('\n\n')}`;
}

/**
 * Call Anthropic API to generate a 2–4 sentence executive summary.
 * Returns null if no API key is set or the call fails.
 */
async function generateLLMSummary(version, structuredNotes, diffText, opts = {}) {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const baseUrl = opts.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const model   = opts.model   || process.env.MODEL || 'claude-3-5-haiku-20241022';

  const prompt = `You are writing release notes for gigabot v${version} — an open-source npm package that lets developers scaffold autonomous AI agents in seconds.

Below is a structured list of changes parsed from conventional commits, followed by a code diff for context.

Your task:
1. Write a short (2–4 sentence) executive summary paragraph that explains what this release delivers in plain English — focus on user-facing value, not implementation details.
2. Return ONLY the summary paragraph. Do not repeat the structured list. Do not add headers.
3. Tone: clear, direct, developer-friendly. No marketing fluff.

Structured changes:
${structuredNotes}

Code diff (for context only — may be truncated):
${diffText || '(no diff available)'}`;

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      process.stderr.write(`LLM API error: ${response.status} ${response.statusText}\n`);
      return null;
    }

    const data = await response.json();
    return data?.content?.[0]?.text?.trim() || null;
  } catch (err) {
    process.stderr.write(`LLM call failed: ${err.message}\n`);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Determine tags
  const toTag   = argv.to   || process.env.TO_TAG   || detectCurrentTag();
  const version = toTag ? toTag.replace(/^v/, '') : 'unknown';
  const isPrerelease = version.includes('-');

  const fromTag = argv.from || process.env.FROM_TAG || detectPreviousTag(toTag, isPrerelease);

  process.stderr.write(`Generating release notes: ${fromTag || '<initial>'} → ${toTag}\n`);

  // Collect commits
  const repo = git('remote get-url origin')
    .replace(/^https?:\/\/[^/]*\//, '')
    .replace(/\.git$/, '')
    .replace(/.*:/, ''); // handles SSH remotes

  const logRange = fromTag ? `${fromTag}..${toTag}` : toTag;
  const logOutput = git(`log --pretty=format:"%s|||%H" ${logRange}`);

  const commits = logOutput
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [subject, hash] = line.split('|||');
      return { subject: subject?.trim(), hash: hash?.trim(), repo };
    })
    .filter(c => c.subject && c.hash);

  process.stderr.write(`Found ${commits.length} commits\n`);

  // Parse commits into typed buckets
  const buckets = parseCommits(commits);
  const structuredNotes = buildStructuredNotes(version, buckets);

  // Get diff for LLM context (capped at 8 KB)
  let diffText = '';
  if (fromTag) {
    diffText = git(
      `diff ${fromTag}..${toTag} -- "*.js" "*.ts" "*.tsx" "*.jsx" "*.mjs" ` +
      `":(exclude)*.min.js" ":(exclude)package-lock.json"`
    ).slice(0, 8000);
  }

  // Optional LLM summary
  const summary = await generateLLMSummary(version, structuredNotes, diffText);
  if (summary) {
    process.stderr.write('LLM summary generated\n');
  } else {
    process.stderr.write('LLM summary skipped (no API key or call failed)\n');
  }

  // Assemble final release notes
  const compareUrl = fromTag
    ? `https://github.com/${repo}/compare/${fromTag}...${toTag}`
    : `https://github.com/${repo}/releases/tag/${toTag}`;

  const parts = [];

  if (summary) {
    parts.push(summary);
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  parts.push(structuredNotes);
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push(`**Full Changelog**: ${compareUrl}`);
  parts.push('');
  parts.push(`**npm**: \`npm install gigabot@${version}\` · **Upgrade**: \`npx gigabot@latest upgrade\``);

  const output = parts.join('\n');

  // Write output
  const outputPath = argv.output || process.env.OUTPUT_FILE;
  if (outputPath) {
    writeFileSync(outputPath, output, 'utf8');
    process.stderr.write(`Written to ${outputPath}\n`);
  } else {
    process.stdout.write(output + '\n');
  }
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
