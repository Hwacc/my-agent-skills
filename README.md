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
│   └── setup-git-hooks.ts  # Git hooks 配置（pull 后自动 link-skills）
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
| 手动同步 | `bun run link-skills` | 立即同步当前 skills 到 Cursor/Claude 配置目录 |

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

### 自动执行机制

- **Git hook**：执行 `bun install` 后自动配置 `post-merge` hook，每次 `git pull` 后自动执行 `bun run link-skills`

### 常见问题

**Q: Windows 下提示「创建软连接失败」或 EPERM**

A: Windows 创建符号链接需要额外权限，可任选其一：
- 开启「开发者模式」：设置 → 隐私和安全性 → 面向开发人员 → 开发人员模式
- 以管理员身份运行终端

**Q: 提示「路径已存在且非软连接」**

A: 目标目录已存在普通文件夹（非软连接）。需先手动删除该目录，或使用 `--force` 尝试覆盖（若为普通目录，仍可能需手动删除）。

**Q: Git hook 未生效**

A: 确保已执行过 `bun install`。若仍无效，可手动运行 `bun run ./scripts/setup-git-hooks.ts` 重新配置。
