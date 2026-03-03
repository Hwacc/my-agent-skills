---
name: i18n-generator
description: Sync i18n JSON from xlsx with dry-run/write modes, override confirmation, locale mapping validation, and safe backups.
version: 2.0.0
---

# i18n-generator
用于把 `.xlsx` 翻译表安全同步到本地 i18n JSON.

## First Thing Frist
开始工作前, 必须完整阅读此份指南

## 覆盖评级

### 评级前注意(非常重要)
 - 当`localValue`是英文且`locale`不为`en`时, 认为是覆盖**fallback**, 其不参与评级, 直接进行覆盖
  
### 评级
 - **S**: 严重冲突,语义和语言结构完全不一致
 - **A**: 较严重,内容有实质差异，可能影响语义
 - **B**: 中等,内容可能略有差异, 不影响语义
 - **C**: 轻微,仅格式差异,内容一致, 
 - **D**: 可忽略,仅空格/格式差异, 

## 工作流程

1. 生成同步分析报告:
   - 使用`bun run "<reportScript>" "<excelPath>" "<localeDir> --ai"`生成同步分析报告`SyncReport`
2. `SyncReport`分析和处理:
   - 阅读**SyncReport 字段解释**
   - 映射冲突:
    - 跳过映射冲突相关字段,并使用``生成映射冲突报告
   - 覆盖候选:
    - 分别读取对应的`localValue`, `excelValue`和`diffType`
    - 根据`localValue`和`excelValue`的**内容**, 参考`diffType`的**信息**,严谨给出**覆盖评级**
    - 依据给出的**覆盖评级**执行其对应评级的**操作**
     - 对于评级为 S、A、B 的覆盖候选:
       1. 暂停执行
       2. 向用户逐条列出冲突项(序号,key,覆盖评级,localValue,excelValue)详情
       3. 明确询问用户覆盖意图(例如: 全部覆盖, 按输入序号覆盖, 按输入序号忽略, 全部忽略等)
       4. 仅在用户明确回复覆盖意图后，才执行覆盖
       5. 若用户拒绝或未回复，则跳过该项 
     - 对于评级为 C, D的覆盖候选:
       - 执行自动覆盖  
       - 如果`localValue`或`excelValue`中有占位符(例如:由`{}`,`{{}}`,`<></>`等特殊标签包裹的字段),则优先考虑使用包含占位符的`value`进行覆盖或不做替换 
   - 新增条目:
    - 依据`key`, `newValue`向`locale`对应的多语言文件写入新增条目
    - 其中`key`的首位单词通常认为是**namespace**(例如: `game_abc`中的`game`, 分隔符常见有`_`, `.`)
    - 根据**namespace**确认写入位置, 通常是相同**namespace**条目的末尾
3. 生成处理报告:
    - 使用`bun run "<reportScript>" "<excelPath>" "<localeDir>` 生成同步报告
    - 报告中增加**覆盖评级**, **覆盖操作**到对应的**覆盖候选**中去
    - 输出报告


## 附加资源
- **reportScript**: `./scripts/sync_report.ts`
- **SyncReport 字段解释** `./references/params_guide.md`

