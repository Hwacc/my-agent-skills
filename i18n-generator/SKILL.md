---
name: i18n-generator
description: Sync i18n JSON from xlsx with dry-run/write modes, override confirmation, locale mapping validation, and safe backups.
---

# i18n-generator

用于把 `.xlsx` 翻译表安全同步到本地 i18n JSON。此版本将固定说明拆分到 `@references`，默认只保留最小执行指令，降低单次调用 token。

## 先做什么（强制）

1. 先确认输入：
   - `excelPath`
   - `localeDir`
2. 先执行 dry-run，再决定是否 `--write`。
3. 任何写入前，必须确认映射冲突为 0。

## 执行顺序（最短路径）

1. 运行 dry-run：
   - `bun run .cursor/skills/i18n-generator/scripts/sync_i18n.ts "<excelPath>" "<localeDir>" --override-mode=a`
2. 检查报告中的：
   - 覆盖候选数量
   - 新增条目数量
   - 自动生成 key 数量
   - 映射冲突数量
3. 若 `映射冲突 > 0`，停止写入并通过 `--override-map` 修正。
4. 需要落盘时执行：
   - `bun run .cursor/skills/i18n-generator/scripts/sync_i18n.ts "<excelPath>" "<localeDir>" --write --override-mode=a`
5. 输出最终报告（覆盖/新增/自动 key/冲突/模式）。

## 何时读取 references

- 流程与分类细节：`@references/01-workflow-and-classification.md`
- locale 映射与冲突规则：`@references/02-locale-mapping.md`
- 命令与报告模板：`@references/03-commands-and-report.md`

仅在当前任务需要该细节时读取对应文件，避免无关上下文注入。

## 不可降低的安全门禁

- 缺少 `en.json` 时必须失败。
- 覆盖项未确认不得写入。
- `--write` 且存在映射冲突时必须阻止写入。

