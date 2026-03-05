#!/usr/bin/env bun
/**
 * 根据 skills 下的 mcps.json 刷新全局 MCP 配置
 * 实现：增加、更新（不删除全局中已有但 skills 中无的配置）
 * 格式：skill/mcps.json 为 [{ "serverName": { config } }, ...]
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

function getProjectRoot(): string {
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  return path.resolve(scriptDir, '..');
}

/**
 * 从 skill 的 mcps.json 解析出 mcpServers 键值对
 * 输入格式: [{ "server1": { config } }, { "server2": { config } }]
 */
function parseSkillMcpJson(content: string): Record<string, McpServerConfig> {
  const trimmed = content.trim();
  if (!trimmed) return {};

  let arr: unknown;
  try {
    arr = JSON.parse(trimmed);
  } catch {
    console.warn('mcps.json 解析失败，跳过');
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
 * 收集所有含 mcps.json 的 skill 的 MCP 配置（后出现的同名覆盖前面）
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
      merged[name] = config; // 覆盖：后扫描的 skill 覆盖先前的
    }
  }
  return merged;
}

/**
 * 深度比较两个配置是否相同
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
 * 根据 skills 聚合配置刷新全局 mcp.json
 * 增加：skills 有但 global 无
 * 更新：两者都有且配置不同
 */
function refreshGlobalConfig(
  configPath: string,
  fromSkills: Record<string, McpServerConfig>,
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

  const existingServers =
    existing.mcpServers && typeof existing.mcpServers === 'object' ? existing.mcpServers : {};

  const added: string[] = [];
  const updated: string[] = [];

  for (const [name, config] of Object.entries(fromSkills)) {
    if (!existingServers[name]) {
      added.push(name);
    } else if (!configEqual(existingServers[name], config)) {
      updated.push(name);
    }
  }

  const newServers = { ...existingServers };
  for (const name of added) {
    newServers[name] = fromSkills[name];
  }
  for (const name of updated) {
    newServers[name] = fromSkills[name];
  }

  const hasChanges = added.length > 0 || updated.length > 0;

  if (hasChanges) {
    const output = {
      ...existing,
      mcpServers: newServers,
    };

    const dir = path.dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      writeFileSync(configPath, JSON.stringify(output, null, 2), 'utf-8');
      const parts: string[] = [];
      if (added.length) parts.push(`新增 ${added.length} 个`);
      if (updated.length) parts.push(`更新 ${updated.length} 个`);
      console.log(`  ${targetName}: ${parts.join('，')}`);
    } catch (err) {
      console.error(`写入 ${targetName} 失败:`, err);
    }
  } else {
    console.log(`  ${targetName}: 无变化`);
  }
}

function parseArgs(): { cursor: boolean; claude: boolean; projectRoot: string } {
  const args = process.argv.slice(2);
  let cursor = true;
  let claude = true;
  let projectRoot = getProjectRoot();

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--cursor':
        cursor = true;
        claude = false;
        break;
      case '--claude':
        cursor = false;
        claude = true;
        break;
      case '--all':
        cursor = true;
        claude = true;
        break;
      case '--project-root': {
        const raw = args[++i] ?? '';
        if (raw) projectRoot = path.resolve(raw.replace(/^([a-zA-Z]):([^\\/])/, '$1:/$2'));
        break;
      }
      default:
        break;
    }
  }

  return { cursor, claude, projectRoot };
}

function main(): void {
  const { cursor, claude, projectRoot } = parseArgs();
  const userHome = getUserHome();

  const configs = collectSkillMcpConfigs(projectRoot);

  console.log('\n--- MCP 配置刷新 ---');

  if (Object.keys(configs).length === 0) {
    console.log('未发现 skill 下的 mcps.json，跳过');
    return;
  }

  if (cursor) {
    const cursorPath = path.join(userHome, '.cursor', 'mcp.json');
    refreshGlobalConfig(cursorPath, configs, 'Cursor');
  }

  if (claude) {
    const claudePath = path.join(userHome, '.claude.json');
    refreshGlobalConfig(claudePath, configs, 'Claude Code');
  }

  console.log('\n完成');
}

main();
