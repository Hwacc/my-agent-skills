# 命令模板与报告格式

## 推荐命令

```bash
# 1) 仅解析 Excel
bun run .cursor/skills/i18n-generator/scripts/read_xlxs.ts "<excelPath>"

# 2) 仅读取本地语言包
bun run .cursor/skills/i18n-generator/scripts/read_local.ts "<localeDir>"

# 3) 完整同步（默认 dry-run）
bun run .cursor/skills/i18n-generator/scripts/sync_i18n.ts "<excelPath>" "<localeDir>" --override-mode=a

# 4) 执行写入
bun run .cursor/skills/i18n-generator/scripts/sync_i18n.ts "<excelPath>" "<localeDir>" --write --override-mode=a
```

## 常用参数

- `--write`：执行落盘；不传即 dry-run。
- `--fallback=empty|en`：缺失翻译回填策略。
- `--override-mode=a|n|y|s:1,2`：覆盖策略。
- `--override-map='{\"zh-cn\":\"zhcn\"}'`：映射覆盖。
- `--backup-dir=<path>`：备份目录。
- `--keep-backups`：保留备份（默认清理）。
- `--cleanup-temp-excel=true|false`：是否清理临时 Excel。

## 报告结构（最小要求）

```markdown
## 🌍 i18n 同步报告

| 类型 | 数量 | 说明 |
| --- | ---: | --- |
| 覆盖候选 | N | X 条已确认覆盖 |
| 新增条目 | N | 按 fallback 策略回填 |
| 自动生成 key | N | 来自缺失 key 行 |
| 映射冲突 | N | 多 locale 指向同列 |

### 🔁 覆盖候选（需确认）
1. ✅ `key_a` (en, de)
2. ⏭️ `key_b` (fr)

### ➕ 新增条目
- `new_key_1`
- `new_key_2`

### ✨ 自动生成 key
- `generated_key` from "EN text"
```

## 写入安全要求

- 仅修改实际有变化的语言文件。
- 写前备份；写后按参数决定是否清理备份。
- JSON 输出保持稳定（2 空格缩进）。
- 不改变现有 key 顺序；新增 key 按首词（`_`/`.` 分隔）插入到对应分组后，无匹配时追加末尾。
