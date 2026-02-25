import { copyFile, mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { readExcelTranslations } from './read_xlxs';
import { readLocalTranslations } from './read_local';
import { TranslationRow } from './read_xlxs';
import { LocaleData } from './read_local';

type FallbackMode = 'empty' | 'en';
type OverrideSelectionMode = 'a' | 'n' | 'y' | 's';

type OverrideCandidate = {
  key: string;
  before: Record<string, string>;
  after: Record<string, string>;
  changedLocales: string[];
};

type CliOptions = {
  excelPath: string;
  localeDir: string;
  write: boolean;
  fallback: FallbackMode;
  overrideMap: Record<string, string>;
  overrideMode?: string;
  backupDir?: string;
  cleanupBackups: boolean;
  cleanupTempExcel: boolean;
};

const getBooleanOption = (
  optionBag: Record<string, string | boolean>,
  key: string,
  defaultValue: boolean,
): boolean => {
  const value = optionBag[key];
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return defaultValue;
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
      '用法: bun run scripts/sync_i18n.ts <excelPath> <localeDir> [--write] [--fallback=empty|en] [--override-mode=a|n|y|s:1,2] [--override-map={"zh-cn":"zhcn"}] [--backup-dir=backups/i18n] [--keep-backups] [--cleanup-temp-excel=true|false]',
    );
  }

  const fallback = (optionBag.fallback as FallbackMode) || 'empty';
  if (fallback !== 'empty' && fallback !== 'en') {
    throw new Error('参数 --fallback 仅支持 empty 或 en。');
  }

  let overrideMap: Record<string, string> = {};
  if (typeof optionBag['override-map'] === 'string') {
    overrideMap = JSON.parse(optionBag['override-map'] as string) as Record<string, string>;
  }

  return {
    excelPath,
    localeDir,
    write: Boolean(optionBag.write),
    fallback,
    overrideMap,
    overrideMode: typeof optionBag['override-mode'] === 'string' ? (optionBag['override-mode'] as string) : undefined,
    backupDir: typeof optionBag['backup-dir'] === 'string' ? (optionBag['backup-dir'] as string) : undefined,
    cleanupBackups: !getBooleanOption(optionBag, 'keep-backups', false),
    cleanupTempExcel: getBooleanOption(optionBag, 'cleanup-temp-excel', true),
  };
};

const getFirstToken = (key: string): string => {
  return key.split(/[._]/)[0] || key;
};

const buildOrderedLocaleData = (
  previousData: LocaleData,
  nextData: LocaleData,
  addedKeys: string[],
): LocaleData => {
  const orderedKeys = Object.keys(previousData);
  const addedKeySet = new Set<string>(addedKeys);

  addedKeys.forEach((addedKey) => {
    if (!(addedKey in nextData) || orderedKeys.includes(addedKey)) {
      return;
    }

    const token = getFirstToken(addedKey);
    let insertAfterIndex = -1;

    for (let index = orderedKeys.length - 1; index >= 0; index -= 1) {
      const currentKey = orderedKeys[index];
      if (!currentKey) {
        continue;
      }
      if (getFirstToken(currentKey) === token) {
        insertAfterIndex = index;
        break;
      }
    }

    if (insertAfterIndex >= 0) {
      orderedKeys.splice(insertAfterIndex + 1, 0, addedKey);
    } else {
      orderedKeys.push(addedKey);
    }
  });

  // 兜底：若存在未覆盖到的 key（非新增且不在原文件中），仍写入末尾避免数据丢失。
  Object.keys(nextData).forEach((key) => {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  });

  const orderedData: LocaleData = {};
  orderedKeys.forEach((key) => {
    if (key in nextData) {
      orderedData[key] = nextData[key];
    }
  });

  return orderedData;
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
): OverrideCandidate[] => {
  const candidates: OverrideCandidate[] = [];

  rows.forEach((row) => {
    if (!(row.key in localEn)) {
      return;
    }

    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    const changedLocales: string[] = [];

    const localEnBefore = localEn[row.key] || '';
    if (localEnBefore !== row.en) {
      before.en = localEnBefore;
      after.en = row.en;
      changedLocales.push('en');
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
      }
    });

    if (changedLocales.length > 0) {
      candidates.push({
        key: row.key,
        before,
        after,
        changedLocales: Array.from(new Set(changedLocales)).sort(),
      });
    }
  });

  return candidates;
};

const parseSelectMode = (mode?: string): { type: OverrideSelectionMode; indexes: Set<number> } => {
  if (!mode) {
    return { type: 'n', indexes: new Set<number>() };
  }

  if (mode === 'a' || mode === 'n' || mode === 'y') {
    return { type: mode, indexes: new Set<number>() };
  }

  if (mode.startsWith('s:')) {
    const indexes = new Set<number>();
    const chunk = mode.slice(2).split(',');
    chunk.forEach((item) => {
      const value = Number(item.trim());
      if (Number.isInteger(value) && value > 0) {
        indexes.add(value - 1);
      }
    });
    return { type: 's', indexes };
  }

  return { type: 'n', indexes: new Set<number>() };
};

const askOverrideMode = async (candidates: OverrideCandidate[]): Promise<{ type: OverrideSelectionMode; indexes: Set<number> }> => {
  if (candidates.length === 0) {
    return { type: 'n', indexes: new Set<number>() };
  }

  const rl = createInterface({ input, output });
  try {
    // eslint-disable-next-line no-console
    console.log('\n覆盖候选确认：a=全部覆盖, n=全部跳过, y=逐条确认, s=按序号选择');
    const mode = (await rl.question('请选择操作 [a/n/y/s]：')).trim().toLowerCase();
    if (mode === 'a' || mode === 'n') {
      return { type: mode, indexes: new Set<number>() };
    }
    if (mode === 'y') {
      const indexes = new Set<number>();
      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const answer = (await rl.question(`[${i + 1}] ${candidate.key} 是否覆盖？[y/N] `)).trim().toLowerCase();
        if (answer === 'y') {
          indexes.add(i);
        }
      }
      return { type: 's', indexes };
    }
    if (mode === 's') {
      const text = await rl.question('输入序号，逗号分隔（如 1,3,8）：');
      const indexes = new Set<number>();
      text
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((num) => Number.isInteger(num) && num > 0)
        .forEach((num) => {
          indexes.add(num - 1);
        });
      return { type: 's', indexes };
    }
    return { type: 'n', indexes: new Set<number>() };
  } finally {
    rl.close();
  }
};

const toSelectionSet = (
  mode: { type: OverrideSelectionMode; indexes: Set<number> },
  total: number,
): Set<number> => {
  if (mode.type === 'a') {
    return new Set<number>(Array.from({ length: total }, (_, index) => index));
  }
  if (mode.type === 's') {
    return mode.indexes;
  }
  return new Set<number>();
};

const buildReport = (params: {
  overrideCandidates: OverrideCandidate[];
  selectedOverrideIndexes: Set<number>;
  newEntries: string[];
  generatedKeys: Array<{ key: string; en: string; fromKey?: string }>;
  conflicts: Array<{ excelColumn: string; locales: string[] }>;
  dryRun: boolean;
  writeBlockedByConflict: boolean;
}) => {
  const {
    overrideCandidates,
    selectedOverrideIndexes,
    newEntries,
    generatedKeys,
    conflicts,
    dryRun,
    writeBlockedByConflict,
  } = params;

  const selectedCount = selectedOverrideIndexes.size;
  const lines: string[] = [];
  lines.push('## 🌍 i18n 同步报告');
  lines.push('');
  lines.push('| 类型 | 数量 | 说明 |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| 覆盖候选 | ${overrideCandidates.length} | ${selectedCount} 条已确认覆盖 |`);
  lines.push(`| 新增条目 | ${newEntries.length} | 按 fallback 策略回填缺失语言 |`);
  lines.push(`| 自动生成 key | ${generatedKeys.length} | 来自 Excel 缺失 key 行 |`);
  lines.push(`| 映射冲突 | ${conflicts.length} | 多 locale 映射到同一 Excel 列 |`);
  lines.push('');
  lines.push(`- 模式：${dryRun ? 'dry-run（不落盘）' : 'write（执行落盘）'}`);
  if (writeBlockedByConflict) {
    lines.push('- 写入状态：检测到映射冲突，已阻止写入');
  }
  lines.push('');

  if (conflicts.length > 0) {
    lines.push('### ⚠️ 映射冲突');
    conflicts.forEach((conflict) => {
      lines.push(`- Excel 列 \`${conflict.excelColumn}\` <- 本地 locale: ${conflict.locales.join(', ')}`);
    });
    lines.push('');
  }

  lines.push('### 🔁 覆盖候选（需确认）');
  if (overrideCandidates.length === 0) {
    lines.push('- 无');
  } else {
    overrideCandidates.forEach((item, index) => {
      const marker = selectedOverrideIndexes.has(index) ? '✅' : '⏭️';
      lines.push(`${index + 1}. ${marker} \`${item.key}\` (${item.changedLocales.join(', ')})`);
    });
  }
  lines.push('');

  lines.push('### ➕ 新增条目');
  if (newEntries.length === 0) {
    lines.push('- 无');
  } else {
    newEntries
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        lines.push(`- \`${key}\``);
      });
  }
  lines.push('');

  lines.push('### ✨ 自动生成 key');
  if (generatedKeys.length === 0) {
    lines.push('- 无');
  } else {
    generatedKeys.forEach((item) => {
      const suffix = item.fromKey ? ` (from "${item.fromKey}")` : '';
      lines.push(`- \`${item.key}\` from "${item.en}"${suffix}`);
    });
  }

  return lines.join('\n');
};

const backupFile = async (filePath: string, backupRoot?: string): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (backupRoot) {
    const backupDirPath = path.resolve(backupRoot);
    await mkdir(backupDirPath, { recursive: true });
    const backupFilePath = path.join(
      backupDirPath,
      `${path.basename(filePath, '.json')}.${timestamp}.bak.json`,
    );
    await copyFile(filePath, backupFilePath);
    return backupFilePath;
  }
  const inlineBackup = `${filePath}.${timestamp}.bak`;
  await copyFile(filePath, inlineBackup);
  return inlineBackup;
};

const shouldCleanupTempExcel = (excelPath: string): boolean => {
  const resolved = path.resolve(excelPath);
  const ext = path.extname(resolved).toLowerCase();
  const name = path.basename(resolved).toLowerCase();
  const normalizedPath = resolved.replace(/\\/g, '/').toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') {
    return false;
  }
  const isTempName = name.startsWith('tmp-') || name.includes('tmp');
  const isSkillArea = normalizedPath.includes('/.cursor/skills/i18n-generator/');
  return isTempName && isSkillArea;
};

const cleanupArtifacts = async (
  options: CliOptions,
  createdBackupFiles: string[],
): Promise<void> => {
  if (options.cleanupBackups && createdBackupFiles.length > 0) {
    await Promise.all(
      createdBackupFiles.map(async (filePath) => {
        try {
          await unlink(filePath);
        } catch {
          // eslint-disable-next-line no-console
          console.warn(`清理备份文件失败：${filePath}`);
        }
      }),
    );
  }

  if (options.cleanupTempExcel && shouldCleanupTempExcel(options.excelPath)) {
    try {
      await unlink(path.resolve(options.excelPath));
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`清理临时 Excel 失败：${options.excelPath}`);
    }
  }
};

const main = async () => {
  const options = parseArgs();
  const rows = readExcelTranslations(options.excelPath);
  const {
    localByLocale,
    localeToExcelColumn,
    conflicts,
  } = await readLocalTranslations(options.localeDir, options.overrideMap);

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
  );
  const newEntries: string[] = [];
  const generatedKeys: Array<{ key: string; en: string; fromKey?: string }> = [];

  const mutatingLocales = new Map<string, LocaleData>();
  localByLocale.forEach((value, localeCode) => {
    mutatingLocales.set(localeCode, { ...value });
  });
  const localEn = mutatingLocales.get('en');
  if (!localEn) {
    throw new Error('本地语言包缺失 en.json，无法以 en 作为基准执行同步。');
  }

  uniqueRows.forEach((row) => {
    if (!(row.key in localEn)) {
      const finalKey = ensureUniqueKey(row.key, localEn);
      if (finalKey !== row.key) {
        row._meta = {
          ...(row._meta || {}),
          isGeneratedKey: true,
          originalKey: row.key,
        };
      }
      row.key = finalKey;
      localEn[finalKey] = row.en;
      newEntries.push(finalKey);

      if (row._meta?.isGeneratedKey) {
        generatedKeys.push({
          key: finalKey,
          en: row.en,
          fromKey: row._meta.originalKey,
        });
      }

      mutatingLocales.forEach((localeData, localeCode) => {
        const excelColumn = localeToExcelColumn.get(localeCode);
        if (!excelColumn) {
          return;
        }
        const directValue = getRowLocaleValue(row, excelColumn);
        if (directValue) {
          localeData[finalKey] = directValue;
          return;
        }
        localeData[finalKey] = localeCode === 'en' || options.fallback === 'en' ? row.en : '';
      });
    }
  });

  let selected = parseSelectMode(options.overrideMode);
  if (!options.overrideMode) {
    selected = await askOverrideMode(overrideCandidates);
  }
  const selectedOverrideIndexes = toSelectionSet(selected, overrideCandidates.length);

  selectedOverrideIndexes.forEach((index) => {
    const candidate = overrideCandidates[index];
    if (!candidate) {
      return;
    }
    const row = rowByKey.get(candidate.key);
    if (!row) {
      return;
    }
    mutatingLocales.forEach((localeData, localeCode) => {
      const excelColumn = localeToExcelColumn.get(localeCode);
      if (!excelColumn) {
        return;
      }
      const next = getRowLocaleValue(row, excelColumn);
      if (next) {
        localeData[candidate.key] = next;
      }
    });
  });

  const writeBlockedByConflict = options.write && conflicts.length > 0;
  const report = buildReport({
    overrideCandidates,
    selectedOverrideIndexes,
    newEntries,
    generatedKeys,
    conflicts,
    dryRun: !options.write,
    writeBlockedByConflict,
  });

  // eslint-disable-next-line no-console
  console.log(report);

  if (!options.write || writeBlockedByConflict) {
    await cleanupArtifacts(options, []);
    return;
  }

  const createdBackupFiles: string[] = [];
  const localeDir = path.resolve(options.localeDir);
  for (const [localeCode, nextData] of Array.from(mutatingLocales.entries())) {
    const previousData = localByLocale.get(localeCode) || {};
    const orderedNextData = buildOrderedLocaleData(previousData, nextData, newEntries);
    const prevJson = JSON.stringify(previousData);
    const nextJson = JSON.stringify(orderedNextData);
    if (prevJson === nextJson) {
      continue;
    }

    const filePath = path.join(localeDir, `${localeCode}.json`);
    const backupPath = await backupFile(filePath, options.backupDir);
    createdBackupFiles.push(backupPath);
    const pretty = `${JSON.stringify(orderedNextData, null, 2)}\n`;
    await writeFile(filePath, pretty, 'utf-8');
  }

  await cleanupArtifacts(options, createdBackupFiles);
};

main().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error(error.message);
  process.exit(1);
});
