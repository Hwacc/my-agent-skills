# Switch 设计细节

## Variant（变体）

| Variant | 说明 | 轨道（checked）主色 |
|---------|------|---------------------|
| **default** | 主开关，Razer 绿 | primary / primary highlight |
| **normal** | 次要开关，灰色 | secondary / secondary highlight |

## State（状态）

| State | 轨道（track） | 滑块（thumb） | 标签（label） |
|-------|---------------|---------------|---------------|
| **unchecked** | secondary 灰 | black | text white secondary |
| **unchecked + hover** | secondary 灰（略透明） | black | text white |
| **checked** | primary | black | text white secondary |
| **checked + hover** | primary highlight | black | text white |
| **focus** | 2px outline primary | — | — |
| **disabled** | 50% 透明度，无 hover | — | 50% 透明度 |
