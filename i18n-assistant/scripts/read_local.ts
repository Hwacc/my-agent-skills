import { readdir, readFile } from 'fs/promises';
import path from 'path';

type LocalePrimitive = string | number | boolean;
type LocaleJson = Record<string, unknown>;

export type FlatLocaleMap = Record<string, string>;

export type LocaleCandidate = {
  localeCode: string;
  filePath: string;
  relativePath: string;
  depth: number;
  siblingLocaleCount: number;
  score: number;
};

export type LocaleReadResult = {
  localeDir: string;
  selected: LocaleCandidate;
  candidates: LocaleCandidate[];
  flatLocale: FlatLocaleMap;
  hasEnglishCandidate: boolean;
};

const LOCALE_EXTENSIONS = new Set(['.json', '.yaml', '.yml']);
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

const normalizeSlash = (value: string): string => value.replace(/\\/g, '/');

const normalizeLocaleCode = (value: string): string => {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
};

const isLocaleFile = (fileName: string): boolean => {
  const ext = path.extname(fileName).toLowerCase();
  return LOCALE_EXTENSIONS.has(ext);
};

const isEnglishLocale = (localeCode: string): boolean => {
  const normalized = normalizeLocaleCode(localeCode);
  return normalized === 'en' || normalized.startsWith('en-');
};

const getLocaleCodeFromFilePath = (filePath: string): string => {
  return normalizeLocaleCode(path.basename(filePath, path.extname(filePath)));
};

const getPathDepth = (relativePath: string): number => {
  return normalizeSlash(relativePath).split('/').length;
};

const walkLocaleFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkLocaleFiles(entryPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && isLocaleFile(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
};

const countSiblingLocaleFiles = async (filePath: string): Promise<number> => {
  const parentDir = path.dirname(filePath);
  const files = await readdir(parentDir, { withFileTypes: true });
  return files.filter((entry) => entry.isFile() && isLocaleFile(entry.name)).length;
};

const rankCandidate = (localeCode: string, relativePath: string, siblingLocaleCount: number): number => {
  const normalized = normalizeLocaleCode(localeCode);
  const baseScore = normalized === 'en' ? 1000 : normalized.startsWith('en-') ? 700 : 100;
  const depthPenalty = getPathDepth(relativePath) * 15;
  const pathLengthPenalty = relativePath.length;
  const siblingBonus = siblingLocaleCount * 6;
  return baseScore + siblingBonus - depthPenalty - pathLengthPenalty;
};

const compareCandidates = (a: LocaleCandidate, b: LocaleCandidate): number => {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.depth !== b.depth) {
    return a.depth - b.depth;
  }
  return a.relativePath.localeCompare(b.relativePath);
};

const flattenLocaleObject = (input: unknown, prefix = '', output: FlatLocaleMap = {}): FlatLocaleMap => {
  if (input === null || input === undefined) {
    return output;
  }

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    if (prefix) {
      output[prefix] = String(input as LocalePrimitive);
    }
    return output;
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      const nextKey = prefix ? `${prefix}.${index}` : String(index);
      flattenLocaleObject(item, nextKey, output);
    });
    return output;
  }

  if (typeof input === 'object') {
    Object.entries(input as LocaleJson).forEach(([key, value]) => {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenLocaleObject(value, nextKey, output);
    });
  }

  return output;
};

const tryLoadYamlParser = async (): Promise<((text: string) => unknown) | null> => {
  try {
    const module = await import('yaml');
    if (module && typeof module.parse === 'function') {
      return module.parse as (text: string) => unknown;
    }
    return null;
  } catch {
    return null;
  }
};

const parseLocaleFile = async (filePath: string): Promise<unknown> => {
  const raw = await readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return JSON.parse(raw);
  }

  if (YAML_EXTENSIONS.has(ext)) {
    const parseYaml = await tryLoadYamlParser();
    if (!parseYaml) {
      throw new Error(
        `检测到 YAML 文件但缺少解析器: ${filePath}。请先执行 "bun add -d yaml" 或改用 JSON locale 文件。`,
      );
    }
    return parseYaml(raw);
  }

  throw new Error(`不支持的 locale 文件类型: ${filePath}`);
};

const parseCliArgs = (argv: string[]): { localeDir: string; fallbackLocale?: string } => {
  let localeDir = 'src/locales/default';
  let fallbackLocale: string | undefined;

  const positional: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith('--fallback=')) {
      fallbackLocale = arg.slice('--fallback='.length).trim();
      continue;
    }
    positional.push(arg);
  }

  if (positional.length > 0) {
    localeDir = positional[0];
  }

  return {
    localeDir,
    fallbackLocale: fallbackLocale ? normalizeLocaleCode(fallbackLocale) : undefined,
  };
};

const buildCandidates = async (localeDir: string): Promise<LocaleCandidate[]> => {
  const files = await walkLocaleFiles(localeDir);
  const candidates: LocaleCandidate[] = [];

  for (const filePath of files) {
    const localeCode = getLocaleCodeFromFilePath(filePath);
    const relativePath = normalizeSlash(path.relative(localeDir, filePath));
    const siblingLocaleCount = await countSiblingLocaleFiles(filePath);

    candidates.push({
      localeCode,
      filePath,
      relativePath,
      depth: getPathDepth(relativePath),
      siblingLocaleCount,
      score: rankCandidate(localeCode, relativePath, siblingLocaleCount),
    });
  }

  return candidates.sort(compareCandidates);
};

const pickLocaleCandidate = (
  candidates: LocaleCandidate[],
  fallbackLocale?: string,
): { selected?: LocaleCandidate; hasEnglishCandidate: boolean } => {
  const englishCandidates = candidates.filter((item) => isEnglishLocale(item.localeCode));
  if (englishCandidates.length > 0) {
    return {
      selected: englishCandidates.sort(compareCandidates)[0],
      hasEnglishCandidate: true,
    };
  }

  if (!fallbackLocale) {
    return {
      hasEnglishCandidate: false,
    };
  }

  const fallbackCandidates = candidates.filter(
    (item) =>
      normalizeLocaleCode(item.localeCode) === fallbackLocale ||
      normalizeLocaleCode(path.basename(item.filePath)) === fallbackLocale,
  );

  return {
    selected: fallbackCandidates.sort(compareCandidates)[0],
    hasEnglishCandidate: false,
  };
};

export const readPrimaryLocale = async (
  localeDir: string,
  fallbackLocale?: string,
): Promise<LocaleReadResult> => {
  const resolvedLocaleDir = path.resolve(localeDir);
  const candidates = await buildCandidates(resolvedLocaleDir);

  if (candidates.length === 0) {
    throw new Error(`目录下未找到 locale 文件: ${resolvedLocaleDir}`);
  }

  const { selected, hasEnglishCandidate } = pickLocaleCandidate(candidates, fallbackLocale);

  if (!selected) {
    const preview = candidates.slice(0, 10).map((item) => item.relativePath);
    throw new Error(
      `未找到 en* locale，请指定 --fallback=<localeCode>。候选: ${preview.join(', ')}`,
    );
  }

  const rawLocale = await parseLocaleFile(selected.filePath);
  const flatLocale = flattenLocaleObject(rawLocale);

  return {
    localeDir: resolvedLocaleDir,
    selected,
    candidates,
    flatLocale,
    hasEnglishCandidate,
  };
};

if ((import.meta as { main?: boolean }).main) {
  const { localeDir, fallbackLocale } = parseCliArgs(process.argv.slice(2));

  readPrimaryLocale(localeDir, fallbackLocale)
    .then((result) => {
      const output = {
        localeDir: result.localeDir,
        selected: {
          localeCode: result.selected.localeCode,
          filePath: result.selected.filePath,
          relativePath: result.selected.relativePath,
          reason: result.hasEnglishCandidate ? 'picked-en' : 'picked-fallback',
        },
        entryCount: Object.keys(result.flatLocale).length,
        flatLocale: result.flatLocale,
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(output, null, 2));
    })
    .catch((error: Error) => {
      // eslint-disable-next-line no-console
      console.error(error.message);
      process.exit(1);
    });
}
