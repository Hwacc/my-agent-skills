# My Agent SKILLS

自定义 Agent Skills 统一管理仓库，支持 Cursor 和 Claude Code。通过软连接将工程内 skills 同步到编辑器配置目录，实现一处修改、两处生效。

## 目录结构

```
my-agent-skills/
├── skills/                 # 统一存放所有 skill 文件夹
│   ├── i18n-assistant/
│   ├── i18n-generator/
│   └── razer-design-guide/
├── scripts/
│   ├── link-skills.ts      # 软连接管理脚本
│   ├── setup-git-hooks.ts  # Git hooks 配置（pull 后自动 link-skills）
│   ├── setup-mcp.ts        # MCP 配置合并（link-skills 时调用：新增、更新）
│   └── refresh-mcp.ts      # MCP 配置刷新（ standalone：新增、更新，不删除）
├── package.json
└── README.md
```

## 操作说明

### 前置要求

- 安装 [Bun](https://bun.sh/)
- Windows 创建软连接需开启「开发者模式」或使用管理员权限

### 首次使用（克隆仓库后）

```bash
# 1. 克隆仓库
git clone <repo-url>
cd my-agent-skills

# 2. 安装并配置（自动配置 Git hooks）
bun install

# 3. 完成。skills 已软连接到 ~/.cursor/skills 和 ~/.claude/skills
```

### 日常操作

| 场景 | 操作 | 说明 |
|------|------|------|
| 拉取最新代码 | `git pull` | 自动执行 link-skills，无需额外操作 |
| 新增 skill | 在 `skills/` 下新建含 `SKILL.md` 的文件夹，然后 `bun run link-skills` 或 `git pull` | 新建的 skill 会自动创建软连接 |
| 删除 skill | 删除 `skills/` 下对应文件夹，然后 `bun run link-skills` 或 `git pull` | 对应软连接会自动移除 |
| 手动同步 | `bun run link-skills` | 立即同步 skills 软连接及 MCP 配置到 Cursor/Claude |

### 命令参数

```bash
# 链接到 Cursor 和 Claude（默认）
bun run link-skills

# 仅链接到 Cursor
bun run link-skills -- --cursor

# 仅链接到 Claude
bun run link-skills -- --claude

# 强制覆盖已存在的链接或目录
bun run link-skills -- --force

# 指定工程根目录（Windows 建议用引号包裹路径，或使用正斜杠）
bun run link-skills -- --project-root "c:/my-workspace/my-agent-skills"
```

### 仅刷新 MCP 配置

若只需同步 MCP 配置、不操作软连接，可单独运行 `refresh-mcp`：

```bash
# 刷新 Cursor 和 Claude Code 的 MCP 配置
bun run refresh-mcp

# 仅刷新 Cursor
bun run refresh-mcp -- --cursor

# 仅刷新 Claude Code
bun run refresh-mcp -- --claude

# 指定工程根目录
bun run refresh-mcp -- --project-root "c:/my-workspace/my-agent-skills"
```

**与 link-skills 的区别**：`refresh-mcp` 仅处理 MCP 配置，不创建/删除软连接。两者对 MCP 的合并规则一致（新增、更新，不删除全局中已有但 skills 中无的配置）。

### 自动执行机制

- **Git hook**：执行 `bun install` 后自动配置 `post-merge` hook，每次 `git pull` 后自动执行 `bun run link-skills`

### MCP 配置（可选）

若 skill 文件夹下存在 `mcps.json`，执行 `link-skills` 时会自动将其中的 MCP 配置合并到 Cursor 和 Claude Code 的全局配置：

| 编辑器 | 全局配置文件 |
|--------|--------------|
| Cursor | `~/.cursor/mcp.json` |
| Claude Code | `~/.claude.json` |

**执行时机**：每次运行 `bun run link-skills` 时（含 `git pull` 触发的自动执行）会扫描所有 skill 的 `mcps.json` 并合并到上述全局配置。

**mcps.json 格式**（数组，每项为 `{ serverName: config }`）：

```json
[
  { "shadcn": { "command": "npx", "args": ["-y", "shadcn@latest", "mcp"] } },
  { "tailwindcss": { "command": "npx", "args": ["-y", "tailwindcss-mcp-server"] } },
  { "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] } }
]
```

**规则说明**：
- 完全重复：若全局配置中已存在同名 server 且配置相同，则跳过
- 配置不同：若同名 server 配置不同，则更新为 skill 中的配置
- 不删除：全局中已有但 skills 中无的 server 会保留
- 自动创建：目标配置文件不存在时会自动创建
- npx 建议加 `-y`：避免 npx 交互提示（如 `Need to install...?`）

### 常见问题

**Q: Windows 下提示「创建软连接失败」或 EPERM**

A: Windows 创建符号链接需要额外权限，可任选其一：
- 开启「开发者模式」：设置 → 隐私和安全性 → 面向开发人员 → 开发人员模式
- 以管理员身份运行终端

**Q: 提示「路径已存在且非软连接」**

A: 目标目录已存在普通文件夹（非软连接）。需先手动删除该目录，或使用 `--force` 尝试覆盖（若为普通目录，仍可能需手动删除）。

**Q: Git hook 未生效**

A: 确保已执行过 `bun install`。若仍无效，可手动运行 `bun run ./scripts/setup-git-hooks.ts` 重新配置。

**Q: MCP 配置未生效**

A: 执行 `bun run link-skills` 后需**重启 Cursor/Claude Code** 才能加载新的 MCP 配置。
