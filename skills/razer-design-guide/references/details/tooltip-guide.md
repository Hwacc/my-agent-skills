# Tooltip 设计细节

## Variant（变体）

| Variant | 说明 | 背景 | 文字 | 边框 |
|---------|------|------|------|------|
| **white** | 白色tooltip | background white (#ffffff) | text black (#000000) | black border (#000)，1px |
| **secondary** | 黑色tooltip | background black (#000) | text white (#ffffff) | white border (#fff), 1px|

## Size（尺寸）

| Size | font size | padding | border radius | 说明 |
|------|-----------|---------|---------------|------|
| **xs** | 12px | 4px 6px | 2px | 轻量提示 |
| **sm** | 14px | 6px 8px | 2px | 常规提示 |
| **base** | 16px | 8px 10px | 2px | 默认档位 |
| **lg** | 18px | 8px 12px | 4px | 强调提示 |

## 其他规范

- **阴影**：
  - shadow black (rgba(0,0,0,0.8))，blur 5px，offset y 2px，适度使用
- **触发方式**：hover 显示，移出隐藏
- **定位**：优先显示在触发元素上方，避免遮挡内容
- **内容**：简短文字，单行或少量多行
- **箭头**: 带有相同背景色和border的三角指示箭头
