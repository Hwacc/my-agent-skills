---
name: razer-design-guide
description: Provides Razer brand design system and style guide for Pencil design work. Use when designing components in .pen files, working with Razer theme, creating UI components following Razer brand guidelines, or when the user mentions Razer design system, style guide, or Pencil design.
version: 1.1.0
---

# Razer 组件设计指南

## First thing first
在使用Pencil设计组件
- 在设计工作开始之前阅读此样式指南
- 此处定义的所有规范将作为最基础的设计指南

## 品牌背景
- **品牌**: Razer
- **描述**: 全球电竞硬件品牌，以标志性 Razer 绿、深色科技风与「For Gamers. By Gamers」理念著称，设计强调科技感、高性能与沉浸式体验

## 颜色指南
- 颜色定义与使用指南请参阅 [references/color-guide.md](references/color-guide.md)

## 尺寸指南
- 尺寸定义与使用指南请参阅 [references/size-guide.md](references/size-guide.md)

## 设计指南
- 通用设计指南请参阅 [references/design-guide.md](references/design-guide.md)

## 模版指南
- 设计产物的模版指南请参阅 [references/template-guide.md](references/template-guide.md)

## 工作流程(非常重要)

在进行Pencil设计时：

1. **阅读指南**: 完整阅读此设计指南
2. **检查上下文**: 查找 .pen 文件中与当前需求对应的 Context 节点中的上下文信息
3. **检索详细设计指南**: 检索`references/details`中与当前需求对应的详细设计指南
4. **使用详细设计指南**:
   - 如果有对应的详细设计指南,则阅读并在设计过程中严格执行,**不进行过度创意**
   - 如果没有对应的详细设计指南,则先在`references/details`创建对应的**详细设计指南**(例如: `button-guide.md`):
     - 创建的**详细设计指南**应当至少包含`variants`,`states`和`sizes`的设计说明
5. **设计产物**: 设计产物应当严格遵循**模版指南**

## 其他资源

- **Razer Store**: https://www.razer.com/store 用于参考Razer设计风格(配色,样式,尺寸等)

## MCP 工具使用指引

以下 MCP 已配置在user scope中，**需主动调用**时使用:
- **ark-ui**: 需要参考 Ark UI 组件、示例、样式指南时 → 使用 ark-ui（list_components、get_example、styling_guide）
- **tailwindcss**: 需要 Tailwind 类名、颜色转换、文档或生成组件模板时 → 使用 tailwindcss MCP 工具
- **rark-crafts**: 需要参考正在开发的Razer组件库预设的`sizes`, `variants`, `animate`时 → 使用 rark-crafts MCP

