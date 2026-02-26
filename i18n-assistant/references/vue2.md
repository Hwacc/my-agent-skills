# Vue 2 i18n 替换参考（vue-i18n）

本参考用于 `i18n-assistant` 在判定为 **Vue 2** 时执行“硬编码文案 → i18n 调用”的最小安全替换。

## 约定与默认

- **默认 i18n 调用**：`this.$t('key')`（脚本中）与 `{{ $t('key') }}`（模板中）
- **属性绑定**：把纯字符串属性改为动态绑定，例如 `title="..."` → `:title="$t('key')"`
- **不引入新库**：只按项目现有写法替换；若发现项目使用不同 API（例如 `i18n.t`），以项目为准。

## 识别“未被 i18n 包裹”的可见文案

### 模板文本节点

- 替换前：
  - `<span>保存</span>`
- 替换后：
  - `<span>{{ $t('common.save') }}</span>`

注意：

- 不要破坏原本的子节点结构与空白敏感布局（必要时只包裹文案那一段）。

### 常见可见属性

优先处理（按需扩展）：`placeholder`、`title`、`aria-label`、`alt`、`label`、`empty-text` 等。

- 替换前：`<input placeholder="请输入用户名">`
- 替换后：`<input :placeholder="$t('user.usernamePlaceholder')">`

如果属性本来就是动态表达式（`:placeholder="foo"`），且 `foo` 来源是硬编码字符串，需要转移到 `$t(...)` 时，应优先在脚本中处理 `foo` 的来源，不要在模板里堆叠拼接。

## 脚本中的文案

仅在明确是 UI 文案时替换，例如：

- `this.$message.success('保存成功')` → `this.$message.success(this.$t('common.saveSuccess'))`

排除：

- 路由 path、接口 path、枚举 key、日志 tag 等。

## 插值与富文本（组件插值）

Vue2 场景常见约束：模板字符串拼接很容易破坏可翻译性。

- 若 locale value 需要插值（例如 `"Hello, {name}"`），优先用 `$t('key', { name })`（如果项目使用 vue-i18n 标准参数）。
- 若涉及 Component Interpolation 的节点时:
  - 加载`references/vue-i18n-v8.md`中Component Interpolation相关指南
  
## 最小改动原则

- 只改文案表达式，不改 DOM 结构、指令、class/style、事件与 props。
- 遇到同文案多 key 的歧义，必须让用户选 key（不要猜）。

