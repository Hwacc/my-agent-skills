# Razer 设计输出模版指南

本文档定义设计产物的模版，适用于pencil设计中的画布组织,frame结构和交付清单打印输出。

## pencil设计

### 画布
- **根节点**：作为整体容器，背景使用 `primary background`
- **分组**：按功能或组件类型分组，使用 `Frame` 或 `Group` 节点
- **层级**：主内容 → 嵌套容器 → 组件实例，层级清晰

### Frame(非常重要)

#### 统一的 Frame 组织结构

所有组件必须遵循统一的 frame 组织结构，确保设计系统的一致性和可维护性：

**1. 主容器 Frame（组件根容器）**
- **背景色**：`#111111` (primary background)
- **布局**：垂直布局 (`layout: "vertical"`)
- **间距**：`gap: 40`
- **内边距**：`padding: 40`
- **命名**：`[组件名]Container`，如 `ButtonContainer`、`SwitchContainer`
- **作用**：作为组件的根容器，包含所有子 Frame 和标题

**2. 标题文本**
- **States-Overview 标题**：`[组件名]-States-Overview`
  - 字体大小：`28px`
  - 颜色：`#ffffff`
  - 位置：主容器内的第一个子元素
- **Sizes-Overview 标题**：`[组件名]-Sizes-Overview`
  - 字体大小：`28px`
  - 颜色：`#ffffff`
  - 位置：States-Overview Frame 之后

**3. States-Overview Frame**
- **命名**：`[组件名]-States-Overview`，如 `Button-States-Overview`、`Switch-States-Overview`
- **背景色**：`#222222` (secondary background)
- **圆角**：`cornerRadius: 4`
- **内边距**：`padding: 40`
- **间距**：`gap: 24`（根据内容调整）
- **作用**：统筹展示组件的状态机设计，如 `unchecked`, `checked`, `hover`, `focus`, `disabled` 等状态或 variant，size 保持统一用 `base`
- **注意**：不使用 stroke 边框

**4. Sizes-Overview Frame**
- **命名**：`[组件名]-Sizes-Overview`，如 `Button-Sizes-Overview`、`Switch-Sizes-Overview`
- **背景色**：`#222222` (secondary background)
- **圆角**：`cornerRadius: 4`
- **内边距**：`padding: 40`
- **间距**：`gap: 24`（根据内容调整）
- **作用**：展示组件的尺寸档位：`xs`, `sm`, `base`, `lg`
- **注意**：不使用 stroke 边框

#### 结构示例

```
[组件名]Container (主容器)
├── [组件名]-States-Overview (标题文本)
├── [组件名]-States-Overview (Frame)
│   └── ... (状态展示内容)
├── [组件名]-Sizes-Overview (标题文本)
└── [组件名]-Sizes-Overview (Frame)
    └── ... (尺寸展示内容)
```

#### 注意事项

- 所有 Overview Frame 的背景色统一使用 `secondary background` (`#222222`)
- 所有 Overview Frame 不使用 stroke 边框
- 主容器使用 `primary background` (`#111111`) 作为背景
- 标题文本使用统一的字体大小和颜色
- 保持组件间的结构一致性，便于维护和扩展

### 命名规则
- **组件组**：`[组件名]-[尺寸档位]`，如 `Button-base`、`Checkbox-sm`
- **状态变体**：`[组件名]-[状态]`，如 `Button-default`、`Button-hover`、`Button-disabled`
- **Variant 变体**：`[组件名]-[variant]`，如 `Button-primary`、`Button-secondary`
- **组合命名**：`[组件名]-[尺寸]-[variant]-[状态]`，如 `Button-base-primary-hover`

## 设计交付清单

完成设计输出时，建议包含：

| 项目 | 说明 |
|------|------|
| 组件名 | 明确组件类型 |
| 尺寸档位 | xs / sm / base / lg |
| variant | primary / secondary / 其他 |
| 状态 | default, hover, active, focus, disabled |
| 颜色引用 | 使用 color-guide 中的命名，非硬编码 |
| 尺寸引用 | 使用 size-guide 中的档位，非随意值 |
| Context | 特殊规则或覆盖说明 |
