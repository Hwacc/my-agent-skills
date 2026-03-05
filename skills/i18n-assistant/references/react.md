# React i18n 替换参考（react-i18next）

本参考用于 `i18n-assistant` 在判定为 **React** 时执行“硬编码文案 → i18n 调用”的最小安全替换。

## 约定与默认

- 默认假设项目使用 `i18next + react-i18next`：
  - 文案函数：`t('key')`
  - 组件插值：`<Trans i18nKey="key" />`

## 识别“未被 i18n 包裹”的可见文案

### JSX 文本节点

- 替换前：`<button>Save</button>`
- 替换后：`<button>{t('common.save')}</button>`

### 常见可见属性

优先处理：`placeholder`、`title`、`aria-label`、`alt`、`label`、`helperText` 等（以组件库为准）。

- `placeholder="Enter name"` → `placeholder={t('user.enterName')}`

注意：

- 不要改动 props 名称与其它表达式，只替换字符串字面量为 `t('...')`。

## hook/import 最小化

- 优先沿用文件/项目中已有的获取 `t` 的方式：
  - `const { t } = useTranslation()` 或自研封装 hook
- 若当前文件没有 `t`，引入 `useTranslation()` 可能导致较大 diff：
  - 先检查同目录/同项目的惯用写法（例如上层传 `t`、或 `i18n.t` 封装）
  - 若无统一约定，再引入 `useTranslation()`，并把改动限制在最小范围

## 组件插值（`<Trans />`）

当满足任一条件时，优先使用 `<Trans />`（或项目等价方案）：

- locale value 含占位符并需要嵌入 React 节点（链接、加粗、按钮）
- 文案需要复数/格式化且项目约定用 `<Trans />` 处理

歧义与风险：

- 不要把复杂 JSX 拼接成字符串再翻译；应让翻译保持完整句子结构。
- 如果 locale 的占位符风格与项目不一致（例如 `{name}` vs `{{name}}`），以项目 i18n 方案为准。

## 反查 key 的要求

- 只使用已读取的 locale（默认 en）进行 value→key 反查。
- value 对应多个 key 时必须让用户选（不要猜）。
- locale 找不到对应 value 时默认不替换，并输出清单供后续补翻译/生成 key。

