import { readdir, readFile } from 'fs/promises';
import path from 'path';

export type LocaleData = Record<string, string>;

export type LocalReadResult = {
  localByLocale: Map<string, LocaleData>;
  localeToExcelColumn: Map<string, string>;
  excelColumnToLocales: Map<string, string[]>;
  conflicts: Array<{ excelColumn: string; locales: string[] }>;
};

const DEFAULT_LOCALE_TO_EXCEL_COLUMN: Record<string, string> = {
  en: 'en',
  de: 'de',
  es: 'es',
  fr: 'fr',
  ja: 'ja',
  ko: 'ko',
  ru: 'ru',
  pt: 'ptbr',
  'pt-br': 'ptbr',
  zhcn: 'zhcn',
  'zh-cn': 'zhcn',
  zhtw: 'zhtw',
  'zh-tw': 'zhtw',
  'zh-cht': 'zhtw',
};

const normalizeLocaleCode = (value: string): string => {
  return String(value || '').trim().toLowerCase();
};

const parseJsonMapArg = (arg?: string): Record<string, string> => {
  if (!arg) {
    return {};
  }
  return JSON.parse(arg) as Record<string, string>;
};

export const buildLocaleMapping = (
  localeCodes: string[],
  overrideMap: Record<string, string> = {},
): {
  localeToExcelColumn: Map<string, string>;
  excelColumnToLocales: Map<string, string[]>;
  conflicts: Array<{ excelColumn: string; locales: string[] }>;
} => {
  const localeToExcelColumn = new Map<string, string>();
  const excelColumnToLocales = new Map<string, string[]>();

  const mergedMap: Record<string, string> = {
    ...DEFAULT_LOCALE_TO_EXCEL_COLUMN,
  };
  Object.entries(overrideMap).forEach(([local, excel]) => {
    mergedMap[normalizeLocaleCode(local)] = String(excel).trim().toLowerCase();
  });

  localeCodes.forEach((localeCode) => {
    const normalized = normalizeLocaleCode(localeCode);
    const excelColumn = mergedMap[normalized] || normalized.replace(/[_\s]+/g, '-');
    localeToExcelColumn.set(localeCode, excelColumn);

    const current = excelColumnToLocales.get(excelColumn) || [];
    current.push(localeCode);
    excelColumnToLocales.set(excelColumn, current);
  });

  const conflicts: Array<{ excelColumn: string; locales: string[] }> = [];
  excelColumnToLocales.forEach((locales, excelColumn) => {
    if (locales.length > 1) {
      conflicts.push({
        excelColumn,
        locales: [...locales].sort(),
      });
    }
  });

  return {
    localeToExcelColumn,
    excelColumnToLocales,
    conflicts,
  };
};

export const readLocalTranslations = async (
  localeDir: string,
  overrideMap: Record<string, string> = {},
): Promise<LocalReadResult> => {
  const resolvedDir = path.resolve(localeDir);
  const files = await readdir(resolvedDir);
  const jsonFiles = files.filter((file) => file.toLowerCase().endsWith('.json'));

  const localByLocale = new Map<string, LocaleData>();

  for (const fileName of jsonFiles) {
    const filePath = path.join(resolvedDir, fileName);
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as LocaleData;
    const localeCode = fileName.replace(/\.json$/i, '');
    localByLocale.set(localeCode, parsed);
  }

  const mapping = buildLocaleMapping(Array.from(localByLocale.keys()), overrideMap);
  return {
    localByLocale,
    ...mapping,
  };
};

if ((import.meta as any).main) {
  const localeDir = process.argv[2];
  const overrideArg = process.argv[3];

  if (!localeDir) {
    // eslint-disable-next-line no-console
    console.error('用法: bun run scripts/read_local.ts <localeDir> [mappingJson]');
    process.exit(1);
  }

  const overrideMap = parseJsonMapArg(overrideArg);
  readLocalTranslations(localeDir, overrideMap)
    .then((result) => {
      const plainResult = {
        locales: Array.from(result.localByLocale.keys()).sort(),
        localeToExcelColumn: Object.fromEntries(result.localeToExcelColumn),
        conflicts: result.conflicts,
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(plainResult, null, 2));
    })
    .catch((error: Error) => {
      // eslint-disable-next-line no-console
      console.error(error.message);
      process.exit(1);
    });
}
