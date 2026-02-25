import path from 'path';
import XLSX from 'xlsx';

export type TranslationRow = {
  key: string;
  en: string;
  de?: string;
  es?: string;
  fr?: string;
  ja?: string;
  ko?: string;
  ptbr?: string;
  ru?: string;
  zhcn?: string;
  zhtw?: string;
  _meta?: {
    isGeneratedKey?: boolean;
    originalKey?: string;
  };
};

const EXCEL_LOCALE_KEYS = ['de', 'es', 'fr', 'ja', 'ko', 'ptbr', 'ru', 'zhcn', 'zhtw'] as const;
const MODULE_KEY_PATTERN = /^\*([^*]+)\*$/;

const normalizeColumnName = (value: string): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
};

const normalizeText = (value: unknown): string => {
  return String(value ?? '').trim();
};

const toKeyBase = (input: string): string => {
  const normalized = input
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return normalized || 'generated_key';
};

const MAX_KEY_WORDS = 5;

const trimKeyWords = (keyBase: string, maxWords: number): string => {
  if (!keyBase) {
    return 'generated_key';
  }
  const words = keyBase.split('_').filter(Boolean);
  if (words.length === 0) {
    return 'generated_key';
  }
  const limit = Math.max(1, maxWords);
  return words.slice(0, limit).join('_');
};

const getWordCount = (value: string): number => {
  return value.split('_').filter(Boolean).length;
};

const parseModulePrefix = (rawKey: string): string | null => {
  const match = rawKey.match(MODULE_KEY_PATTERN);
  if (!match) {
    return null;
  }
  const moduleName = String(match[1] || '').trim();
  if (!moduleName) {
    return null;
  }
  return toKeyBase(moduleName);
};

const generateUniqueKey = (
  enText: string,
  usedKeys: Set<string>,
  prefix?: string,
): string => {
  const safePrefix = prefix ? trimKeyWords(prefix, MAX_KEY_WORDS) : '';
  const prefixWordCount = safePrefix ? getWordCount(safePrefix) : 0;
  const baseWordBudget = Math.max(1, MAX_KEY_WORDS - prefixWordCount);
  const base = trimKeyWords(toKeyBase(enText), baseWordBudget);
  const keyBase = safePrefix ? `${safePrefix}_${base}` : base;
  if (!usedKeys.has(keyBase)) {
    usedKeys.add(keyBase);
    return keyBase;
  }

  let index = 2;
  let candidate = `${keyBase}_${index}`;
  while (usedKeys.has(candidate)) {
    index += 1;
    candidate = `${keyBase}_${index}`;
  }
  usedKeys.add(candidate);
  return candidate;
};

export const readExcelTranslations = (excelPath: string): TranslationRow[] => {
  const resolvedPath = path.resolve(excelPath);
  const workbook = XLSX.readFile(resolvedPath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel 文件中没有可用工作表。');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  const results: TranslationRow[] = [];
  const usedKeys = new Set<string>();

  rawRows.forEach((raw) => {
    const normalizedRow: Record<string, string> = {};
    Object.entries(raw).forEach(([columnName, value]) => {
      normalizedRow[normalizeColumnName(columnName)] = normalizeText(value);
    });

    const rawKey = normalizeText(normalizedRow.key);
    const en = normalizeText(normalizedRow.en);

    if (rawKey.toLowerCase() === 'ignore') {
      return;
    }
    if (!en) {
      return;
    }

    let key = rawKey;
    const row: TranslationRow = { key: '', en };
    const modulePrefix = parseModulePrefix(rawKey);

    if (!key || modulePrefix) {
      key = generateUniqueKey(en, usedKeys, modulePrefix || undefined);
      row._meta = {
        isGeneratedKey: true,
        originalKey: rawKey,
      };
    } else if (usedKeys.has(key)) {
      let index = 2;
      let candidate = `${key}_${index}`;
      while (usedKeys.has(candidate)) {
        index += 1;
        candidate = `${key}_${index}`;
      }
      key = candidate;
      row._meta = {
        isGeneratedKey: true,
        originalKey: rawKey,
      };
      usedKeys.add(key);
    } else {
      usedKeys.add(key);
    }

    row.key = key;
    EXCEL_LOCALE_KEYS.forEach((locale) => {
      const value = normalizeText(normalizedRow[locale]);
      if (value) {
        row[locale] = value;
      }
    });
    results.push(row);
  });

  return results;
};

if ((import.meta as any).main) {
  const excelPath = process.argv[2];
  if (!excelPath) {
    // eslint-disable-next-line no-console
    console.error('用法: bun run scripts/read_xlxs.ts <excelPath>');
    process.exit(1);
  }

  const rows = readExcelTranslations(excelPath);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 2));
}
