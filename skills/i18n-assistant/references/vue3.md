# Vue 3 i18n 替换参考（vue-i18n）

本参考用于 `i18n-assistant` 在判定为 **Vue 3** 时执行“硬编码文案 → i18n 调用”的最小安全替换。

## 约定与默认

- **`<template>`**: 常见`{{ $t('key') }}` 。
- **`<script setup>`**: 通常`import {useI18n} from 'vue-i18n`后通过 `const { t } = useI18n()` 然后 `t('key')`。

## 识别与替换规则

### 模板文本节点

- `<span>Save</span>` → `<span>{{ $t('common.save') }}</span>`

### 常见可见属性

- `title="..."` → `:title="$t('key')"`

### `<script setup>` 文案

典型替换形态：

- `const { t } = useI18n()` 之后：
  - `notify('Saved')` → `notify(t('common.saved'))`

### 插值与富文本（组件插值）

- 若 locale value 需要插值, 例如 `"Hello, {name}"`:
  - **`<template>`**: `$t('key', { name })`
  - **`<script setup>`**: `t('key', { name })` 
- 若涉及 Component Interpolation 的节点时:
  - 加载`references/vue-i18n-v9_v11.md`中Component Interpolation相关指南

## 最小改动原则

- 只改文案表达式，不改 DOM 结构、指令、class/style、事件与 props。
- 遇到同文案多 key 的歧义，必须让用户选 key（不要猜）。

