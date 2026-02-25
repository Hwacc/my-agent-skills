---
name: i18n-assistant
description: Detects the current frontend framework (vue2/vue3/react) from package.json, loads the corresponding i18n replacement references, finds the highest-priority English locale file (en) in the project, then replaces hardcoded user-visible strings in target files/folders with framework-appropriate i18n calls (t/$t/<Trans>/<i18n-t>) by mapping text back to existing locale keys. Use when the user asks to “i18n 化/国际化/替换文案为 t/$t/Trans/i18n-t”, mentions vue-i18n/i18next/react-i18next, or wants to fill/replace i18n keys without changing component structure.
---

# i18n-assistant

把代码里的**硬编码可见文案**安全替换为 i18n 调用（Vue2/Vue3/React），并且**只使用项目中已存在的 locale(en 优先)** 来反查 key，避免凭空造翻译。

## 适用范围与边界（先读）

- **只做**：在指定文件/文件夹（或默认范围）内，把“未被 `t(...)` / `$t(...)` 等 i18n 包裹的可见文案”替换为对应的 i18n key 调用。
- **不做（本版默认）**：
  - 不批量新增/生成新的翻译条目（locale 里没有的文案默认不替换；需要的话单独开需求）。
  - 不改动组件结构、CSS/class、props 语义、事件绑定、条件渲染逻辑；只替换文案表达方式。
  - 不在没有把握时“猜 key”；遇到歧义必须列出候选并让用户选择。

## 必要输入（启动前确认）

从用户消息中提取/确认（允许为空则按默认）：

- **target**：用户指定要处理的文件/文件夹路径；未指定则默认处理 `src/`（若不存在则改为项目根下的常见源码目录，如 `app/`、`packages/*/src/`，以实际结构为准）。
- **localeDir（可选）**：用户指定 i18n 目录；未指定则自动搜索。
- **framework（可选）**：用户明确指定框架时优先使用；否则自动识别。
- **i18n 运行时库（可选）**：若用户说明使用 `vue-i18n` / `react-i18next` / `i18next` / `react-intl` 等，按说明优先；否则按 references 的默认约定处理。

## 总体流程（必须按顺序）

### 1) 识别当前框架（vue2 / vue3 / react）

按以下顺序判定（以 `package.json` 为主，必要时参考 lockfile）：

1. **React**：存在 `react`（通常同时有 `react-dom`）。
2. **Vue**：存在 `vue`：
   - **Vue 3**：`vue` 主版本为 3（或存在 `@vue/compiler-sfc`、`vue/compiler-sfc` 等 Vue3 生态依赖）。
   - **Vue 2**：`vue` 主版本为 2（或存在 `vue-template-compiler`、`@vue/composition-api` 等 Vue2 生态依赖）。

冲突处理：

- 若同时存在 React 与 Vue（单仓多包/微前端常见），则以 **target 所在包**的 `package.json` 判定；否则让用户指定要处理哪一套。

### 2) 读取对应 references（按框架）

只读取与你判定的框架相关的参考指南，避免注入无关上下文：

- **Vue 2**：`references/vue2.md`
- **Vue 3**：`references/vue3.md`
- **React**：`references/react.md`

若工程 i18n 方案与 references 默认不一致（例如 React 用 `react-intl` 而非 `react-i18next`），以用户说明为准，并在 references 的“兼容策略”小节里选最接近的做法。

### 3) 在当前工程搜索并读取 locale（只读一种语言）

目标：读取 **en** 的 locale 作为“反查 key 的字典”，一旦成功读取，**停止读取其他语言**。

#### 3.1 locale 文件搜索策略（从高到低）

优先搜索以下常见位置与命名（json/yaml/yml）：

- `**/locales/en.{json,yaml,yml}`
- `**/locales/en-*.{json,yaml,yml}`（如 `en-US`）
- `**/i18n/en.{json,yaml,yml}`
- `**/lang/en.{json,yaml,yml}`
- `**/messages/en.{json,yaml,yml}`

若存在多份 en：

- 选**最像主入口**的一份：路径更短、靠近 `src/`、与其它语言并列的目录（如 `en.json` 与 `zh-CN.json` 同级）。
- 仍不确定时，列出候选让用户选择（不要猜）。

#### 3.2 en 不存在时的处理（强制询问）

- 如果项目里找不到任何 `en*` locale，必须询问用户：
  - 让用户指定“最高优先级语言文件”（例如 `zh-CN.json`），并声明后续将以该文件反查 key。

> 脚本占位：此步骤未来可用 `scripts/read_local.ts` 自动完成（本次先不引入/不实现脚本细节）。

### 4) 在 target 中替换硬编码文案为 i18n 调用（核心）

#### 4.1 扫描范围

- 若用户给了 **文件/文件夹**：只处理该范围。
- 否则处理默认源码目录（通常 `src/`）。
- 文件类型按框架限定（避免误改）：
  - **Vue**：`*.vue`、必要时 `*.ts`/`*.js`（仅当明确是 UI 文案常量/配置）
  - **React**：`*.tsx`/`*.jsx`、必要时 `*.ts`/`*.js`

#### 4.2 “未被 i18n 包裹的文案”定义（必须可解释）

按框架分别判断（细节见对应 references）：

- **Vue2/Vue3**：模板中的纯文本节点、以及可见属性（如 `placeholder/title/aria-label/alt` 等）里**不在** `$t('...')` / `{{ $t(...) }}` / `<i18n-t ...>` 中的字符串。
- **React**：JSX 文本节点、以及可见属性（如 `placeholder/title/aria-label/alt` 等）里**不在** `t('...')` / `<Trans ...>` 中的字符串。

排除项（默认不替换）：

- 明显非用户可见的字符串：路由 path、API 路径、CSS 选择器、测试用例断言、日志关键字、埋点 eventName 等。
- 很可能是业务 key/枚举的字符串常量（除非用户明确要求）。

#### 4.3 反查 locale 得到 key（只用已存在 locale）

把 locale 视为 `key -> value` 的字典（支持嵌套对象，需 flatten 成 `a.b.c` 形式）：

- **匹配规则**（从强到弱）：
  - value 与待替换文本 **完全一致**（忽略两端空白）且唯一匹配 → 直接使用该 key
  - 多个 key value 相同 → 进入“歧义处理”
  - 找不到匹配 → 默认不替换，并输出清单（作为后续补翻译/生成 key 的输入）

歧义处理（必须给用户可选项）：

- 输出候选 key 列表，并优先推荐：
  - 更短、更语义化的 key（如 `common.save` 优于 `page.settings.buttons.save`，仅当项目约定允许）
  - 与当前文件/组件路径更接近的命名空间（如 `user.profile.*`）
- 让用户选择后再改动（不要猜）。

#### 4.4 生成替换代码（保持结构不变）

替换原则：

- **只替换文案表达式**，不改变标签层级、属性名、事件、样式、class、布局结构。
- 尽量保持原有空白/换行（除非 references 明确要求格式化）。
- 替换后代码应仍可被编译/类型检查通过（必要时补全 import/初始化，但不引入大规模重构）。

##### 4.4.1 简单文案

- Vue：`"保存"` → `{{ $t('common.save') }}` 或 `:title="$t('...')"`（按场景）
- React：`Save` → `{t('common.save')}` 或 `title={t('...')}`（按场景）

##### 4.4.2 插值/富文本（Component Interpolation）

当满足任一条件时，优先走“组件插值”方案（按 references）：

- locale value 含占位符（如 `{name}`、`{count}`）且需要拼接 React/Vue 节点
- locale value 包含链接/强调等需要保留为组件的片段

Vue 常见做法：`<i18n-t keypath="...">...</i18n-t>`（或项目约定的等价写法）  
React 常见做法：`<Trans i18nKey="...">...</Trans>`（或项目约定的等价写法）

#### 4.5 结果输出（必须）

完成后输出一份可审查摘要：

- **framework**：识别结果与依据（依赖项）
- **locale**：选用的 locale 文件路径与语言（en 或用户指定）
- **changed files**：修改了哪些文件、每个文件替换了多少处
- **skipped**：未替换的文案清单（找不到 locale 匹配 / 被排除 / 不确定）
- **ambiguous**：歧义候选与需要用户决策的点

## 安全门禁（必须遵守）

- 找不到 `en` locale 时**必须停下并询问用户**指定最高优先级语言文件。
- 任何歧义匹配（同文案对应多个 key）**不得擅自选择**。
- 不允许为了替换而大规模改写组件结构；若必须重构才能正确 i18n，先停下给出最小可行改动方案并征求用户确认。

## 附加资源

- Vue2 参考：`references/vue2.md`
- Vue3 参考：`references/vue3.md`
- React 参考：`references/react.md`

