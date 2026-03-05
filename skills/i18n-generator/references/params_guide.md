# JSON 报告字段说明

使用 `--ai` 或 `--ai-report` 参数时，`sync_report.ts` 输出 JSON 格式报告。本文档说明各字段含义。

## 顶层结构

```json
{
  "summary": { ... },
  "conflicts": [ ... ],
  "overrideCandidates": [ ... ],
  "newEntries": [ ... ],
  "generatedKeys": [ ... ]
}
```

---

## summary

汇总统计。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `overrideCandidates` | number | 覆盖候选数量：本地与 Excel 存在差异的 key |
| `newEntries` | number | 新增条目数量：Excel 有而本地无的 key |
| `generatedKeys` | number | 自动生成 key 数量：来自 Excel 缺失 key 行（如 `*module*` 格式） |
| `conflicts` | number | 映射冲突数量：多 locale 映射到同一 Excel 列 |

---

## conflicts

映射冲突列表。当多个本地 locale 文件映射到同一 Excel 列时产生。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `excelColumn` | string | Excel 列名（如 `zhcn`、`zhtw`） |
| `locales` | string[] | 映射到该列的本地 locale 代码（如 `["zh-cn", "zhcn"]`） |

---

## overrideCandidates

覆盖候选列表。key 同时存在于 Excel 和本地，且至少一个 locale 的值不同。

每个元素：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | string | i18n key（如 `gameclip_don_t_miss_your`） |
| `excelRow` | number | Excel 行号（1-based，含表头） |
| `locales` | array | 有差异的 locale 详情 |

### locales 数组元素

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `locale` | string | 语言代码（如 `en`、`zh-cn`） |
| `excelCell` | string | Excel 单元格引用（如 `F6`、`E9`） |
| `localKey` | string | 本地 JSON 中的 key（与父级 `key` 相同） |
| `localValue` | string | 本地 JSON 中的当前翻译值 |
| `excelValue` | string | Excel 中对应单元格的值 |
| `diffType` | string | 差异类型，见下方 diffType 说明 |

### diffType 取值

| 值 | 说明 |
| --- | --- |
| `空格数量不同` | 仅空格数量/位置不同，内容一致 |
| `换行格式（本地 {br} vs Excel 空格）` | 本地用 `{br}` 换行，Excel 用空格 |
| `换行格式` | 换行格式不同，且可能伴随内容差异 |
| `换行格式、内容` | 同时存在换行格式和内容差异 |
| `内容` | 文本内容不同 |
| `空格/格式` | 其他空格或格式差异 |
| `格式差异` | 未归类的格式差异 |

---

## newEntries

新增条目列表。Excel 中存在而本地不存在的 key。

每个元素：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | string | 将写入本地的 key |
| `excelRow` | number | Excel 行号（1-based） |
| `values` | array | 各语言的翻译值 |

### values 数组元素

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `locale` | string | 语言代码 |
| `excelCell` | string | Excel 单元格引用（如 `E12`） |
| `localKey` | string | 将写入的 key（与父级 `key` 相同） |
| `newValue` | string | 从 Excel 读取的翻译值，将写入本地 |

---

## generatedKeys

自动生成 key 列表。Excel 中 key 列为空或 `*module*` 等格式时，由 en 列内容自动生成 key。

每个元素：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | string | 生成的 key（如 `player_1_2kill_s`） |
| `excelCell` | string | 来源 Excel 单元格（en 列，如 `E12`） |
| `fromKey` | string | Excel 原始 key 或模块前缀（如 `*player*`） |

---

## 示例

```json
{
  "summary": {
    "overrideCandidates": 2,
    "newEntries": 7,
    "generatedKeys": 7,
    "conflicts": 0
  },
  "overrideCandidates": [
    {
      "key": "gameclip_don_t_miss_your",
      "excelRow": 6,
      "locales": [
        {
          "locale": "de",
          "excelCell": "F6",
          "localKey": "gameclip_don_t_miss_your",
          "localValue": "LASS DIR DEINE BESTEN GAMING-MOMENTE NICHT ENTGEHEN",
          "excelValue": "LASS DIR DEINE  BESTEN GAMING-MOMENTE NICHT ENTGEHEN",
          "diffType": "空格数量不同"
        }
      ]
    }
  ],
  "newEntries": [
    {
      "key": "player_1_2kill_s",
      "excelRow": 12,
      "values": [
        {
          "locale": "en",
          "excelCell": "E12",
          "localKey": "player_1_2kill_s",
          "newValue": "1-2KILL(S)"
        }
      ]
    }
  ],
  "generatedKeys": [
    {
      "key": "player_1_2kill_s",
      "excelCell": "E12",
      "fromKey": "*player*"
    }
  ]
}
```
