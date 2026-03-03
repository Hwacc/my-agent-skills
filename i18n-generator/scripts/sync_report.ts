import { readExcelTranslations } from './read_xlxs';
import { readLocalTranslations } from './read_local';
import { TranslationRow, ExcelColumnMap } from './read_xlxs';
import { LocaleData } from './read_local';

type FallbackMode = 'empty' | 'en';

type OverrideCandidate = {
  key: string;
  excelRow: number;
  before: Record<string, string>;
  after: Record<string, string>;
  changedLocales: string[];
  excelCellsByLocale: Record<string, string>;
  diffByLocale: Record<string, string>;
};

const describeDiff = (before: string, after: string): string => {
  const reasons: string[] = [];
  const beforeNorm = before.replace(/\s+/g, ' ').trim();
  const afterNorm = after.replace(/\s+/g, ' ').trim();
  const beforeNoBr = before.replace(/\{br\}/g, ' ').replace(/\s+/g, ' ').trim();
  const afterNoBr = after.replace(/\{br\}/g, ' ').replace(/\s+/g, ' ').trim();

  if (before.includes('{br}') !== after.includes('{br}')) {
    if (beforeNoBr === afterNoBr) {
      reasons.push('换行格式（本地 {br} vs Excel 空格）');
    } else {
      reasons.push('换行格式');
    }
  }

  if (beforeNorm === afterNorm && reasons.length === 0) {
    if (/  +/.test(before) || /  +/.test(after)) {
      reasons.push('空格数量不同');
    } else {
      reasons.push('空格/格式');
    }
  } else if (beforeNorm !== afterNorm && beforeNoBr !== afterNoBr) {
    reasons.push('内容');
  }

  return reasons.length > 0 ? reasons.join('、') : '格式差异';
};

type NewEntryWithValues = {
  key: string;
  excelRow: number;
  excelValuesByLocale: Record<string, string>;
  excelCellsByLocale: Record<string, string>;
};

type CliOptions = {
  excelPath: string;
  localeDir: string;
  fallback: FallbackMode;
  aiReport: boolean;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const optionBag: Record<string, string | boolean> = {};

  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      optionBag[key] = value === undefined ? true : value;
    } else {
      positional.push(arg);
    }
  });

  const [excelPath, localeDir] = positional;
  if (!excelPath || !localeDir) {
    throw new Error(
      '用法: bun run scripts/sync_report.ts <excelPath> <localeDir> [--fallback=empty|en] [--ai]'
    );
  }

  const fallback = (optionBag.fallback as FallbackMode) || 'empty';
  if (fallback !== 'empty' && fallback !== 'en') {
    throw new Error('参数 --fallback 仅支持 empty 或 en。');
  }

  const aiReport = Boolean(optionBag.ai || optionBag['ai-report']);

  return {
    excelPath,
    localeDir,
    fallback,
    aiReport
  };
};

const ensureUniqueKey = (desiredKey: string, localEn: LocaleData): string => {
  if (!(desiredKey in localEn)) {
    return desiredKey;
  }

  let index = 2;
  let candidate = `${desiredKey}_${index}`;
  while (candidate in localEn) {
    index += 1;
    candidate = `${desiredKey}_${index}`;
  }
  return candidate;
};

const getRowLocaleValue = (row: TranslationRow, excelColumn: string): string | undefined => {
  if (excelColumn === 'en') {
    return row.en;
  }
  return row[excelColumn as keyof TranslationRow] as string | undefined;
};

const buildOverrideCandidates = (
  rows: TranslationRow[],
  localEn: LocaleData,
  localeToExcelColumn: Map<string, string>,
  localByLocale: Map<string, LocaleData>,
  columnMap: ExcelColumnMap
): OverrideCandidate[] => {
  const candidates: OverrideCandidate[] = [];

  rows.forEach((row) => {
    if (!(row.key in localEn)) {
      return;
    }

    const excelRow = row._meta?.excelRow ?? 0;
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    const excelCellsByLocale: Record<string, string> = {};
    const diffByLocale: Record<string, string> = {};
    const changedLocales: string[] = [];

    const localEnBefore = localEn[row.key] || '';
    if (localEnBefore !== row.en) {
      before.en = localEnBefore;
      after.en = row.en;
      changedLocales.push('en');
      diffByLocale.en = describeDiff(localEnBefore, row.en);
      const colLetter = columnMap.en;
      if (colLetter) excelCellsByLocale.en = `${colLetter}${excelRow}`;
    }

    localeToExcelColumn.forEach((excelColumn, localeCode) => {
      if (localeCode === 'en') {
        return;
      }
      const next = getRowLocaleValue(row, excelColumn);
      if (!next) {
        return;
      }
      const localeData = localByLocale.get(localeCode);
      if (!localeData) {
        return;
      }
      const prev = localeData[row.key] || '';
      if (prev !== next) {
        before[localeCode] = prev;
        after[localeCode] = next;
        changedLocales.push(localeCode);
        diffByLocale[localeCode] = describeDiff(prev, next);
        const colLetter = columnMap[excelColumn];
        if (colLetter) excelCellsByLocale[localeCode] = `${colLetter}${excelRow}`;
      }
    });

    if (changedLocales.length > 0) {
      candidates.push({
        key: row.key,
        excelRow,
        before,
        after,
        changedLocales: Array.from(new Set(changedLocales)).sort(),
        excelCellsByLocale,
        diffByLocale
      });
    }
  });

  return candidates;
};

const buildReport = (params: {
  overrideCandidates: OverrideCandidate[];
  newEntries: NewEntryWithValues[];
  generatedKeys: Array<{ key: string; excelCell?: string; fromKey?: string }>;
  conflicts: Array<{ excelColumn: string; locales: string[] }>;
}) => {
  const { overrideCandidates, newEntries, generatedKeys, conflicts } = params;

  const lines: string[] = [];
  lines.push('## 🌍 i18n 同步报告');
  lines.push('');
  lines.push('| 类型 | 数量 | 说明 |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| 覆盖候选 | ${overrideCandidates.length} | 本地与 Excel 存在差异的 key |`);
  lines.push(`| 新增条目 | ${newEntries.length} | Excel 有而本地无的 key |`);
  lines.push(`| 自动生成 key | ${generatedKeys.length} | 来自 Excel 缺失 key 行 |`);
  lines.push(`| 映射冲突 | ${conflicts.length} | 多 locale 映射到同一 Excel 列 |`);
  lines.push('');
  lines.push('');

  if (conflicts.length > 0) {
    lines.push('### ⚠️ 映射冲突');
    conflicts.forEach((conflict) => {
      lines.push(
        `- Excel 列 \`${conflict.excelColumn}\` <- 本地 locale: ${conflict.locales.join(', ')}`
      );
    });
    lines.push('');
  }

  lines.push('### 🔁 覆盖候选');
  if (overrideCandidates.length === 0) {
    lines.push('- 无');
  } else {
    overrideCandidates.forEach((item, index) => {
      lines.push(`${index + 1}. \`${item.key}\` 第 ${item.excelRow} 行 (${item.changedLocales.join(', ')})`);
      lines.push('');
      lines.push('| 语言 | Excel 位置 | 本地位置 | 本地值 | Excel 值 | 差异 |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      item.changedLocales.forEach((locale) => {
        const cell = item.excelCellsByLocale[locale] ?? '-';
        const localVal = (item.before[locale] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const excelVal = (item.after[locale] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const diff = item.diffByLocale[locale] ?? '-';
        lines.push(`| ${locale} | ${cell} | \`${item.key}\` | ${localVal} | ${excelVal} | ${diff} |`);
      });
      lines.push('');
    });
  }
  lines.push('');

  lines.push('### ➕ 新增条目');
  if (newEntries.length === 0) {
    lines.push('- 无');
  } else {
    newEntries
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key))
      .forEach((entry) => {
        lines.push(`- \`${entry.key}\` 第 ${entry.excelRow} 行`);
        const locales = Object.keys(entry.excelValuesByLocale).sort();
        if (locales.length > 0) {
          lines.push('');
          lines.push('| 语言 | Excel 位置 | 本地位置 | 新增值 |');
          lines.push('| --- | --- | --- | --- |');
          locales.forEach((locale) => {
            const cell = entry.excelCellsByLocale[locale] ?? '-';
            const val = (entry.excelValuesByLocale[locale] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
            lines.push(`| ${locale} | ${cell} | \`${entry.key}\` | ${val} |`);
          });
          lines.push('');
        }
      });
  }
  lines.push('');

  lines.push('### ✨ 自动生成 key');
  if (generatedKeys.length === 0) {
    lines.push('- 无');
  } else {
    generatedKeys.forEach((item) => {
      const excelPos = item.excelCell ? ` from ${item.excelCell}` : '';
      const fromKey = item.fromKey ? ` (from "${item.fromKey}")` : '';
      lines.push(`- \`${item.key}\`${excelPos}${fromKey}`);
    });
  }

  return lines.join('\n');
};

type ReportParams = {
  overrideCandidates: OverrideCandidate[];
  newEntries: NewEntryWithValues[];
  generatedKeys: Array<{ key: string; excelCell?: string; fromKey?: string }>;
  conflicts: Array<{ excelColumn: string; locales: string[] }>;
};

const buildAIReport = (params: ReportParams): string => {
  const { overrideCandidates, newEntries, generatedKeys, conflicts } = params;

  const aiReport = {
    summary: {
      overrideCandidates: overrideCandidates.length,
      newEntries: newEntries.length,
      generatedKeys: generatedKeys.length,
      conflicts: conflicts.length
    },
    conflicts: conflicts.map((c) => ({
      excelColumn: c.excelColumn,
      locales: c.locales
    })),
    overrideCandidates: overrideCandidates.map((item) => ({
      key: item.key,
      excelRow: item.excelRow,
      locales: item.changedLocales.map((locale) => ({
        locale,
        excelCell: item.excelCellsByLocale[locale],
        localKey: item.key,
        localValue: item.before[locale],
        excelValue: item.after[locale],
        diffType: item.diffByLocale[locale]
      }))
    })),
    newEntries: newEntries
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((entry) => ({
        key: entry.key,
        excelRow: entry.excelRow,
        values: Object.keys(entry.excelValuesByLocale)
          .sort()
          .map((locale) => ({
            locale,
            excelCell: entry.excelCellsByLocale[locale],
            localKey: entry.key,
            newValue: entry.excelValuesByLocale[locale]
          }))
      })),
    generatedKeys: generatedKeys.map((item) => ({
      key: item.key,
      excelCell: item.excelCell,
      fromKey: item.fromKey
    }))
  };

  return JSON.stringify(aiReport, null, 2);
};

const main = async () => {
  const options = parseArgs();
  const { rows, columnMap } = readExcelTranslations(options.excelPath);
  const { localByLocale, localeToExcelColumn, conflicts } = await readLocalTranslations(
    options.localeDir,
    {}
  );

  const originalLocalEn = localByLocale.get('en');
  if (!originalLocalEn) {
    throw new Error('本地语言包缺失 en.json，无法以 en 作为基准执行同步。');
  }

  const rowByKey = new Map<string, TranslationRow>();
  rows.forEach((row) => {
    rowByKey.set(row.key, row);
  });
  const uniqueRows = Array.from(rowByKey.values());

  const overrideCandidates = buildOverrideCandidates(
    uniqueRows,
    originalLocalEn,
    localeToExcelColumn,
    localByLocale,
    columnMap
  );
  const newEntries: NewEntryWithValues[] = [];
  const generatedKeys: Array<{ key: string; excelCell?: string; fromKey?: string }> = [];

  const localEnSnapshot = { ...originalLocalEn };

  uniqueRows.forEach((row) => {
    if (!(row.key in localEnSnapshot)) {
      const finalKey = ensureUniqueKey(row.key, localEnSnapshot);
      if (finalKey !== row.key) {
        row._meta = {
          ...(row._meta || {}),
          isGeneratedKey: true,
          originalKey: row.key
        };
      }
      localEnSnapshot[finalKey] = row.en;

      const excelRow = row._meta?.excelRow ?? 0;
      const excelValuesByLocale: Record<string, string> = {};
      const excelCellsByLocale: Record<string, string> = {};
      excelValuesByLocale.en = row.en;
      const enCol = columnMap.en;
      if (enCol) excelCellsByLocale.en = `${enCol}${excelRow}`;
      localeToExcelColumn.forEach((excelColumn, localeCode) => {
        if (localeCode === 'en') return;
        const val = getRowLocaleValue(row, excelColumn);
        if (val) {
          excelValuesByLocale[localeCode] = val;
          const colLetter = columnMap[excelColumn];
          if (colLetter) excelCellsByLocale[localeCode] = `${colLetter}${excelRow}`;
        }
      });
      newEntries.push({ key: finalKey, excelRow, excelValuesByLocale, excelCellsByLocale });

      if (row._meta?.isGeneratedKey) {
        const enCol = columnMap.en;
        const excelCell = enCol && excelRow ? `${enCol}${excelRow}` : undefined;
        generatedKeys.push({
          key: finalKey,
          excelCell,
          fromKey: row._meta.originalKey
        });
      }
    }
  });

  const reportParams = {
    overrideCandidates,
    newEntries,
    generatedKeys,
    conflicts
  };

  const report = options.aiReport ? buildAIReport(reportParams) : buildReport(reportParams);

  // eslint-disable-next-line no-console
  console.log(report);
};

main().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error(error.message);
  process.exit(1);
});
