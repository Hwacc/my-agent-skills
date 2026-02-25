# i18n 同步流程与分类规则

## 输入与输出

- 输入：
  - Excel：`.xlsx`
  - 语言包目录：`<localeDir>/*.json`
- 输出：
  - 同步报告（Markdown）
  - 可选写回 JSON（写前备份）
  - 覆盖项确认结果

## 行级处理规则（Excel）

- `key=ignore`（大小写不敏感）直接跳过。
- `en` 为空时跳过该行。
- `key` 为空或模块占位（如 `*gameclip*`）时自动生成 key，并标记 `_meta.isGeneratedKey=true`。

## 标准执行流程

1. 读取 Excel：得到 `TranslationRow[]`。
2. 读取本地语言包：得到 `Map<localeCode, Record<key, text>>`。
3. 以 `en.json` 作为基准比对与分类：
   - 覆盖候选：本地已有同 key，且 `en` 或任一 locale 文本有变化。
   - 新增条目：本地 `en` 不存在该 key。
   - 自动生成 key：来自 Excel 缺失 key/模块占位 key 的行。
4. 生成报告并执行覆盖确认（全量、逐条、按序号、全跳过）。
5. `--write` 时落盘；否则 dry-run 仅输出报告。

## 分类与写入细则

### 覆盖候选（Override）

- 默认不写入，需确认后才写。
- 报告至少包含：`key`、变更 locale 列表、已确认/跳过状态。

### 新增条目（New Entries）

- 对每个 locale 写入相同 key。
- 值优先级：
  - Excel 对应列有值：写该值。
  - Excel 对应列无值：
    - `en` 必写 `excelRow.en`。
    - 非 `en`：按 `fallback` 策略写 `""` 或回退 `en`。

### 自动生成 key（Generated Key）

- 作为新增条目写入。
- 需在报告中记录 `generatedKey` 与 `source(en)`。
- 若生成 key 冲突，必须确定性去重（如 `_2/_3`）。

## 质量门禁

- 缺少 `en.json` 必须失败，不允许静默降级。
- 映射冲突必须在报告中显式展示。
- 写入仅允许在映射校验通过后执行。
