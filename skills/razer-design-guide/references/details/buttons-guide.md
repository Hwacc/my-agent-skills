# Button 设计细节

## Variant（变体）

| Variant | 说明 | 主色 |
|---------|------|------|
| **default** | 主要操作，Razer 绿填充 | primary / primary highlight / primary dark |
| **normal** | 次要操作，灰色填充 | secondary / secondary highlight / secondary dark |
| **outline** | 描边样式，透明背景 | 边框与文字同色 |
| **text** | 纯文字，无边框 | 透明背景，文字色 |
| **icon** | 仅图标 | 同 text |

## State（状态）

| State | default | normal | outline | text / icon |
|-------|---------|--------|---------|-------------|
| **default** | 背景 primary，文字 black | 背景 secondary，文字 white | 透明背景，边框+文字 secondary | 透明背景，文字 white |
| **hover** | 背景 primary highlight | 背景 secondary highlight | 边框+文字 white | 背景 secondary background，文字 white |
| **active** | 背景 primary dark | 背景 secondary dark | 边框+文字 secondary highlight | 背景 secondary dark，文字 secondary |
| **focus** | 2px outline primary | 2px outline secondary | 2px outline secondary | 2px outline secondary |
| **disabled** | 50% 透明度，无 hover/active | 同上 | 同上 | 同上 |
