import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { createModel } from './model.js';
import { createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getSkillBuildingGuideTool, getSkillDetailsTool, createStartCodingTool, createGetRepositoryDetailsTool } from './tools.js';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { jobPlanningMd, codePlanningMd, gigaclawDb } from '../paths.js';
import { render_md } from '../utils/render-md.js';
import { createWebSearchTool, getProvider } from './web-search.js';

/** Cache agents by provider:model key so each combo is created once */
const _agentCache = new Map();

/**
 * Build a cache key from provider overrides (falls back to env defaults).
 */
function agentCacheKey(options = {}) {
  const p = options.providerOverride || process.env.LLM_PROVIDER || 'anthropic';
  const m = options.modelOverride || process.env.LLM_MODEL || 'default';
  return `${p}:${m}`;
}

/**
 * Get or create a LangGraph job agent.
 * Supports per-request provider/model overrides for hybrid mode.
 * Agents are cached by provider:model key.
 *
 * @param {object} [options]
 * @param {string} [options.providerOverride] - LLM provider override
 * @param {string} [options.modelOverride] - LLM model override
 * @returns {Promise<object>} LangGraph agent
 */
export async function getJobAgent(options = {}) {
  const key = agentCacheKey(options);

  if (!_agentCache.has(key)) {
    const model = await createModel(options);
    const tools = [createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getSkillBuildingGuideTool, getSkillDetailsTool];

    const webSearchTool = await createWebSearchTool();
    if (webSearchTool) {
      tools.push(webSearchTool);
      console.log(`[agent] Web search enabled (provider: ${getProvider()})`);
    }

    const checkpointer = SqliteSaver.fromConnString(gigaclawDb);

    const agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: checkpointer,
      prompt: (state) => [new SystemMessage(render_md(jobPlanningMd)), ...state.messages],
    });

    _agentCache.set(key, agent);
  }
  return _agentCache.get(key);
}

/**
 * Reset all cached agents (e.g., when config changes).
 */
export function resetAgent() {
  _agentCache.clear();
}

const _codeAgents = new Map();

/**
 * Get or create a code agent for a specific chat/workspace.
 * Each code chat gets its own agent with unique start_coding tool bindings.
 * Supports per-request provider/model overrides for hybrid mode.
 *
 * @param {object} context
 * @param {string} context.repo - GitHub repo
 * @param {string} context.branch - Git branch
 * @param {string} context.workspaceId - Pre-created workspace row ID
 * @param {string} context.chatId - Chat thread ID
 * @param {string} [context.providerOverride] - LLM provider override
 * @param {string} [context.modelOverride] - LLM model override
 * @returns {Promise<object>} LangGraph agent
 */
export async function getCodeAgent({ repo, branch, workspaceId, chatId, providerOverride, modelOverride }) {
  const cacheKey = `${chatId}:${providerOverride || 'default'}:${modelOverride || 'default'}`;
  if (_codeAgents.has(cacheKey)) {
    return _codeAgents.get(cacheKey);
  }

  const model = await createModel({ providerOverride, modelOverride });
  const startCodingTool = createStartCodingTool({ repo, branch, workspaceId });
  const getRepoDetailsTool = createGetRepositoryDetailsTool({ repo, branch });
  const tools = [startCodingTool, getRepoDetailsTool];

  const webSearchTool = await createWebSearchTool();
  if (webSearchTool) {
    tools.push(webSearchTool);
    console.log(`[agent] Web search enabled for code agent (provider: ${getProvider()})`);
  }

  const checkpointer = SqliteSaver.fromConnString(gigaclawDb);

  const agent = createReactAgent({
    llm: model,
    tools,
    checkpointSaver: checkpointer,
    prompt: (state) => [new SystemMessage(render_md(codePlanningMd)), ...state.messages],
  });

  _codeAgents.set(cacheKey, agent);
  return agent;
}
