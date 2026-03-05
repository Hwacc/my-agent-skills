#!/usr/bin/env bun
/**
 * 收集 skills 下的 mcp.json，合并到 Cursor/Claude Code 全局 MCP 配置
 * 格式：skill/mcp.json 为 [{ "serverName": { config } }, ...]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { platform } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SKILLS_DIR = 'skills';
const MCP_JSON = 'mcps.json';

type McpServerConfig = Record<string, unknown>;

function getUserHome(): string {
  const home = platform() === 'win32' ? process.env.USERPROFILE : process.env.HOME;
  if (!home) {
    console.error('错误: 无法获取用户目录');
    process.exit(1);
  }
  return home;
}

/**
 * 从 skill 的 mcp.json 解析出 mcpServers 键值对
 * 输入格式: [{ "server1": { config } }, { "server2": { config } }]
 */
function parseSkillMcpJson(content: string): Record<string, McpServerConfig> {
  const trimmed = content.trim();
  if (!trimmed) return {};

  let arr: unknown;
  try {
    arr = JSON.parse(trimmed);
  } catch {
    console.warn('mcp.json 解析失败，跳过');
    return {};
  }

  if (!Array.isArray(arr)) {
    console.warn('mcps.json 格式应为数组 [{ serverName: config }, ...]，跳过');
    return {};
  }

  const result: Record<string, McpServerConfig> = {};
  for (const item of arr) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      for (const [name, config] of Object.entries(item)) {
        if (name && config && typeof config === 'object') {
          result[name] = config as McpServerConfig;
        }
      }
    }
  }
  return result;
}

/**
 * 收集所有含 mcp.json 的 skill 的 MCP 配置
 */
function collectSkillMcpConfigs(projectRoot: string): Record<string, McpServerConfig> {
  const skillsPath = path.join(projectRoot, SKILLS_DIR);
  if (!existsSync(skillsPath)) return {};

  const merged: Record<string, McpServerConfig> = {};
  const entries = readdirSync(skillsPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mcpPath = path.join(skillsPath, entry.name, MCP_JSON);
    if (!existsSync(mcpPath)) continue;

    let content: string;
    try {
      content = readFileSync(mcpPath, 'utf-8');
    } catch (err) {
      console.warn(`读取 ${entry.name}/${MCP_JSON} 失败:`, err);
      continue;
    }

    const configs = parseSkillMcpJson(content);
    for (const [name, config] of Object.entries(configs)) {
      if (!merged[name]) {
        merged[name] = config;
      }
    }
  }
  return merged;
}

/**
 * 深度比较两个配置是否相同（用于去重）
 */
function configEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object).sort();
    const keysB = Object.keys(b as object).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
    }
    for (const k of keysA) {
      if (!configEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
  }
  return false;
}

/**
 * 合并到全局 mcp.json，去重（按 server 名称，已存在则跳过）
 */
function mergeIntoGlobalConfig(
  configPath: string,
  toMerge: Record<string, McpServerConfig>,
  targetName: string
): void {
  let existing: { mcpServers?: Record<string, McpServerConfig> } = {};
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8').trim();
      if (raw) {
        existing = JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`读取 ${targetName} 配置失败，将新建:`, err);
    }
  }

  if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
    existing.mcpServers = {};
  }

  let added = 0;
  for (const [name, config] of Object.entries(toMerge)) {
    if (existing.mcpServers[name]) {
      if (configEqual(existing.mcpServers[name], config)) {
        continue; // 完全重复，跳过
      }
      // 同名但配置不同，保留原有，不覆盖（去重规则：已存在则不追加）
      continue;
    }
    existing.mcpServers[name] = config;
    added++;
  }

  if (added > 0) {
    try {
      writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8');
      console.log(`  ${targetName}: 已追加 ${added} 个 MCP 配置`);
    } catch (err) {
      console.error(`写入 ${targetName} 失败:`, err);
    }
  }
}

export function runSetupMcp(
  projectRoot: string,
  userHome: string,
  options: { cursor: boolean; claude: boolean }
): void {
  const configs = collectSkillMcpConfigs(projectRoot);
  if (Object.keys(configs).length === 0) return;

  console.log('\n--- MCP 配置 ---');

  if (options.cursor) {
    const cursorPath = path.join(userHome, '.cursor', 'mcp.json');
    const cursorDir = path.dirname(cursorPath);
    if (!existsSync(cursorDir)) {
      mkdirSync(cursorDir, { recursive: true });
    }
    mergeIntoGlobalConfig(cursorPath, configs, 'Cursor');
  }

  if (options.claude) {
    const claudePath = path.join(userHome, '.claude.json');
    mergeIntoGlobalConfig(claudePath, configs, 'Claude Code');
  }
}
