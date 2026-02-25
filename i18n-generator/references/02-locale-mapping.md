# locale 映射规范

## Excel 列名约定

- `en`
- `de`
- `es`
- `fr`
- `ja`
- `ko`
- `ptbr`
- `ru`
- `zhcn`
- `zhtw`

## 本地文件名到 Excel 列映射（默认）

- `en -> en`
- `de -> de`
- `es -> es`
- `fr -> fr`
- `ja -> ja`
- `ko -> ko`
- `pt -> ptbr`
- `pt-br -> ptbr`
- `ru -> ru`
- `zh-cn -> zhcn`
- `zhcn -> zhcn`
- `zh-tw -> zhtw`
- `zh-cht -> zhtw`
- `zhtw -> zhtw`

## 映射冲突定义与处理

- 冲突定义：多个本地 locale 映射到同一个 Excel 列。
- 处理要求：
  - 必须在报告中列出冲突项（列名与涉及 locale）。
  - `--write` 场景下检测到冲突，应阻止写入。
  - 允许通过 `--override-map='{\"local\":\"excelColumn\"}'` 覆盖映射。

## 兼容策略

- 优先用默认映射；未知 locale 使用归一化名称回退。
- 所有映射需在同步前完成校验，不可边写入边修正。
