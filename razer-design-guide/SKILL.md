---
name: razer-style-guide
description: Provides Razer brand design system and style guide for Pencil design work. Use when designing components in .pen files, working with Razer theme, creating UI components following Razer brand guidelines, or when the user mentions Razer design system, style guide, or Pencil design.
version: 1.0.0
---

# Razer 样式指南

## First thing first
在使用Pencil设计组件时:
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
3. **检索细粒度指南**: 检索`references/details`中与当前需求对应的细粒度的设计指南
4. **设计产物**: 设计产物应当严格遵循**模版指南**

## 其他资源

- **Razer Store**: https://www.razer.com/store 用于参考Razer设计风格(配色,样式,尺寸等)
- `packages/themes/src/default/crafts` 用于参考项目中一些预设的组件尺寸

## MCP 工具使用指引

以下 MCP 已配置于 `.cursor/mcp.json`，**需主动调用**时使用：
- **shadcn MCP**：需参考 shadcn-ui 组件规范、props、结构时 → 使用 shadcn MCP 搜索/浏览对应组件
- **tailwindcss MCP**：需 Tailwind 类名、颜色转换、文档或生成组件模板时 → 使用 tailwindcss MCP 工具
- **ark-ui MCP**：需参考 Ark UI 组件、示例、样式指南时 → 使用 ark-ui MCP（list_components、get_example、styling_guide）
