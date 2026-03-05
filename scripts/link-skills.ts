#!/usr/bin/env bun
/**
 * Skills 软连接统一管理脚本
 * 将工程 skills 文件夹下的 skill 子文件夹软连接到 Cursor 和 Claude Code 的配置目录
 */

import { existsSync, mkdirSync, readdirSync, readlinkSync, statSync, symlinkSync, unlinkSync } from 'fs';
import { platform } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SKILL_MD = 'SKILL.md';
const SKILLS_DIR = 'skills';

type Target = 'cursor' | 'claude';

function getUserHome(): string {
  const home = platform() === 'win32' ? process.env.USERPROFILE : process.env.HOME;
  if (!home) {
    console.error('错误: 无法获取用户目录，请检查 USERPROFILE (Windows) 或 HOME (Linux/macOS) 环境变量');
    process.exit(1);
  }
  return home;
}

function getProjectRoot(): string {
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  return path.resolve(scriptDir, '..');
}

function parseArgs(): {
  cursor: boolean;
  claude: boolean;
  force: boolean;
  projectRoot: string;
} {
  const args = process.argv.slice(2);
  let cursor = true;
  let claude = true;
  let force = false;
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
      case '--force':
        force = true;
        break;
      case '--project-root': {
        const raw = args[++i] ?? '';
        projectRoot = path.resolve(normalizeProjectRootPath(raw));
        break;
      }
    }
  }

  return { cursor, claude, force, projectRoot };
}

/**
 * 规范化 --project-root 路径，修复 PowerShell 等 shell 可能吞掉反斜杠导致的问题
 * 例如 c:\my-workspace\my-agent-skills 被传成 c:my-workspacemy-agent-skills
 */
function normalizeProjectRootPath(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  // 修复 drive:path 缺少首部分隔符 (c:my -> c:/my)
  s = s.replace(/^([a-zA-Z]):([^\\\/])/, '$1:/$2');
  // 修复路径段被拼接 (workspacemy -> workspace/my)
  s = s.replace(/workspacemy/g, 'workspace/my');
  return s;
}

function getConfigPaths(userHome: string): Record<Target, string> {
  return {
    cursor: path.join(userHome, '.cursor', 'skills'),
    claude: path.join(userHome, '.claude', 'skills'),
  };
}

function ensureSkillsDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`已创建目录: ${dir}`);
  }
}

function scanProjectSkills(projectRoot: string): string[] {
  const skillsPath = path.join(projectRoot, SKILLS_DIR);
  if (!existsSync(skillsPath)) {
    ensureSkillsDir(skillsPath);
    return [];
  }

  const entries = readdirSync(skillsPath, { withFileTypes: true });
  const skills: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsPath, entry.name);
    const skillMdPath = path.join(skillPath, SKILL_MD);
    if (existsSync(skillMdPath)) {
      skills.push(entry.name);
    }
  }

  return skills;
}

function isSymlink(filePath: string): boolean {
  try {
    const stat = statSync(filePath, { throwIfNoEntry: false });
    return stat?.isSymbolicLink() ?? false;
  } catch {
    return false;
  }
}

function getSymlinkTarget(linkPath: string): string | null {
  try {
    const target = readlinkSync(linkPath);
    return path.isAbsolute(target) ? target : path.resolve(path.dirname(linkPath), target);
  } catch {
    return null;
  }
}

function pathIsUnder(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function cleanupOrphanedSymlinks(
  configSkillsDir: string,
  projectRoot: string,
  validSkills: Set<string>,
  force: boolean
): void {
  const skillsDir = path.join(projectRoot, SKILLS_DIR);
  if (!existsSync(configSkillsDir)) return;

  const entries = readdirSync(configSkillsDir, { withFileTypes: true });
  for (const entry of entries) {
    const linkPath = path.join(configSkillsDir, entry.name);
    if (!entry.isSymbolicLink()) continue;

    const target = getSymlinkTarget(linkPath);
    if (!target) continue;

    if (!pathIsUnder(skillsDir, target)) continue;

    const skillName = path.basename(target);
    if (validSkills.has(skillName)) continue;

    try {
      unlinkSync(linkPath);
      console.log(`已移除孤岛软连接: ${entry.name} -> ${target}`);
    } catch (err) {
      console.error(`移除软连接失败 ${linkPath}:`, err);
    }
  }
}

function createSymlinks(
  configSkillsDir: string,
  projectRoot: string,
  skills: string[],
  force: boolean
): void {
  ensureSkillsDir(configSkillsDir);
  const skillsDir = path.join(projectRoot, SKILLS_DIR);

  for (const skillName of skills) {
    const targetPath = path.join(skillsDir, skillName);
    const linkPath = path.join(configSkillsDir, skillName);

    if (!existsSync(targetPath)) continue;

    if (!existsSync(linkPath)) {
      try {
        symlinkSync(targetPath, linkPath, 'dir');
        console.log(`已创建软连接: ${skillName} -> ${targetPath}`);
      } catch (err) {
        console.error(`创建软连接失败 ${skillName}:`, err);
        if (platform() === 'win32') {
          console.error('提示: Windows 下若失败，请开启「开发者模式」或使用管理员权限运行');
        }
      }
      continue;
    }

    if (isSymlink(linkPath)) {
      const currentTarget = getSymlinkTarget(linkPath);
      const normalizedTarget = path.resolve(targetPath);
      const normalizedCurrent = currentTarget ? path.resolve(currentTarget) : '';
      if (normalizedCurrent === normalizedTarget) {
        console.log(`跳过（已存在且正确）: ${skillName}`);
        continue;
      }
      if (!force) {
        console.error(`软连接已存在但指向不同目标: ${skillName}，使用 --force 强制覆盖`);
        continue;
      }
      try {
        unlinkSync(linkPath);
      } catch (err) {
        console.error(`删除旧链接失败 ${linkPath}:`, err);
        continue;
      }
    } else {
      if (!force) {
        console.error(`路径已存在且非软连接: ${linkPath}，使用 --force 强制覆盖（需手动删除普通目录）`);
        continue;
      }
      console.error(`无法覆盖普通目录，请手动删除: ${linkPath}`);
      continue;
    }

    try {
      symlinkSync(targetPath, linkPath, 'dir');
      console.log(`已重建软连接: ${skillName} -> ${targetPath}`);
    } catch (err) {
      console.error(`创建软连接失败 ${skillName}:`, err);
    }
  }
}

function main(): void {
  const { cursor, claude, force, projectRoot } = parseArgs();
  const userHome = getUserHome();
  const configPaths = getConfigPaths(userHome);

  const skills = scanProjectSkills(projectRoot);
  if (skills.length === 0) {
    console.log('未发现 skill 文件夹（需在 skills 目录下包含 SKILL.md 的子文件夹）');
    process.exit(0);
  }

  const validSkills = new Set(skills);
  const targets: { name: Target; path: string }[] = [];
  if (cursor) targets.push({ name: 'cursor', path: configPaths.cursor });
  if (claude) targets.push({ name: 'claude', path: configPaths.claude });

  for (const { name, path: configPath } of targets) {
    console.log(`\n--- ${name} ---`);
    cleanupOrphanedSymlinks(configPath, projectRoot, validSkills, force);
    createSymlinks(configPath, projectRoot, skills, force);
  }

  console.log('\n完成');
}

main();
