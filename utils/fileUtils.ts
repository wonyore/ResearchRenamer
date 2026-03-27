import {
  NamingSource,
  NumberFormat,
  PDFFieldSource,
  PDFMetadataResult,
  RenamingRule,
  ResearchFile,
} from '../types';

type PdfJsModule = typeof import('pdfjs-dist');

type PdfJsContext = {
  pdfjs: PdfJsModule;
  workerUrl: string;
};

type PdfDateStringLike = {
  toDateObject: (input: string) => Date | null;
};

type PdfMetadataHandle = {
  get: (name: string) => unknown;
} | null;

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type PdfTextLine = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  pageNumber: number;
};

type PdfDocumentLike = {
  numPages: number;
  getMetadata: () => Promise<{
    info: Record<string, unknown>;
    metadata: PdfMetadataHandle;
  }>;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: (params?: {
      disableNormalization?: boolean;
      includeMarkedContent?: boolean;
    }) => Promise<{ items: unknown[] }>;
    cleanup: (resetStats?: boolean) => boolean;
  }>;
  destroy: () => Promise<void>;
};

type PdfBodyFields = {
  title: string | null;
  author: string | null;
  year: string | null;
};

type PdfMetadataFields = {
  title: string | null;
  author: string | null;
  year: string | null;
};

type ResolvedPdfField = {
  value: string | null;
  source: PDFFieldSource | null;
};

type ResolvedNamingField = {
  value: string | null;
  source: NamingSource | null;
};

type TextBlockSelection = {
  text: string;
  startIndex: number;
  endIndex: number;
  fontSize: number;
};

let pdfJsPromise: Promise<PdfJsContext> | null = null;

const ISO_DATE_PATTERN = /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g;
const SECTION_BREAK_PATTERN = /^(abstract|summary|keywords?|index terms?|introduction)\b/i;
const TITLE_EXCLUSION_PATTERN =
  /\b(abstract|keywords?|index terms?|references|copyright|doi|www\.|http|@|arxiv|preprint|proceedings|journal|volume|issue|received|accepted)\b/i;
const AUTHOR_EXCLUSION_PATTERN =
  /\b(university|department|school|college|institute|laboratory|lab|center|centre|hospital|faculty|email|e-mail|doi|www\.|http|abstract|keywords?|index terms?|introduction)\b/i;
const YEAR_KEYWORD_PATTERN =
  /\b(copyright|published|publication|proceedings|conference|journal|volume|vol\.?|issue|arxiv|preprint|online|article)\b/i;
const YEAR_PENALTY_PATTERN = /\b(received|revised|accepted|submitted|manuscript)\b/i;
const PREFERRED_METADATA_KEYS = ['x-default', 'default', 'en-US', 'en', 'und'];

const loadPdfJs = async (): Promise<PdfJsContext> => {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return {
        pdfjs,
        workerUrl: workerModule.default,
      };
    });
  }

  return pdfJsPromise;
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\0/g, '').replace(/\s+/g, ' ').trim();

type LeadingNumberingInfo = {
  originalNumber: number | null;
  cleanValue: string;
};

const extractLeadingNumbering = (value: string): LeadingNumberingInfo => {
  const trimmedValue = value.trim();
  const patterns: RegExp[] = [
    /^\[(\d{1,5})\]/,
    /^\((\d{1,5})\)/,
    /^(?:P|V|No\.?)\s*[-_]?\s*(\d{1,5})(?=$|[\s._-])/i,
    /^(\d{1,5})(?=$|[\s._-])/,
    /^(\d{1,5})(?=[A-Za-z0-9]{1,6}~\d+$)/,
  ];

  for (const pattern of patterns) {
    const match = trimmedValue.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const cleanValue = trimmedValue
      .slice(match[0].length)
      .replace(/^[\s._-]+/, '')
      .trim();

    return {
      originalNumber: parseInt(match[1], 10),
      cleanValue: cleanValue || trimmedValue,
    };
  }

  return {
    originalNumber: null,
    cleanValue: trimmedValue,
  };
};

const stripLeadingNumbering = (value: string): string => extractLeadingNumbering(value).cleanValue;

const sanitizeTitle = (title: string | null): string | null => {
  if (!title) {
    return null;
  }

  const normalized = normalizeWhitespace(title)
    .replace(/\.pdf$/i, '')
    .replace(INVALID_FILENAME_CHARS, ' ')
    .trim();

  if (!normalized || /^untitled$/i.test(normalized)) {
    return null;
  }

  const cleaned = normalized
    .replace(/^(\[\d{1,5}\]|\(\d{1,5}\)|(?:P|V|No\.?)\s*[-_]?\d{1,5}|\d{1,5}[._-])[\s._-]*/i, '')
    .trim();

  return cleaned || normalized;
};

const collectMetadataStrings = (value: unknown): string[] => {
  if (typeof value === 'string') {
    const normalized = normalizeWhitespace(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMetadataStrings(item));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const prioritized = PREFERRED_METADATA_KEYS.flatMap((key) =>
      key in record ? collectMetadataStrings(record[key]) : []
    );

    if (prioritized.length > 0) {
      return prioritized;
    }

    return Object.values(record).flatMap((item) => collectMetadataStrings(item));
  }

  return [];
};

const dedupeValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
};

const normalizeMetadataText = (value: unknown): string | null => {
  const values = dedupeValues(collectMetadataStrings(value));
  return values[0] ?? null;
};

const normalizeMetadataPeople = (value: unknown): string | null => {
  const values = dedupeValues(collectMetadataStrings(value));
  return values.length > 0 ? values.join('; ') : null;
};

const getMetadataValue = (
  metadata: PdfMetadataHandle,
  keys: string[],
  normalizer: (value: unknown) => string | null = normalizeMetadataText
): string | null => {
  for (const key of keys) {
    const normalized = normalizer(metadata?.get(key));
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const getInfoValue = (
  info: Record<string, unknown>,
  keys: string[],
  normalizer: (value: unknown) => string | null = normalizeMetadataText
): string | null => {
  for (const key of keys) {
    const normalized = normalizer(info[key]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const extractYearFromValue = (
  value: unknown,
  pdfDateString: PdfDateStringLike
): string | null => {
  const normalized = normalizeMetadataText(value);
  if (!normalized) {
    return null;
  }

  const parsed = pdfDateString.toDateObject(normalized);
  if (parsed) {
    return String(parsed.getFullYear());
  }

  const match = normalized.match(YEAR_PATTERN);
  return match ? match[0] : null;
};

const isPdfTextItem = (item: unknown): item is PdfTextItem =>
  typeof item === 'object' &&
  item !== null &&
  'str' in item &&
  'transform' in item &&
  typeof (item as PdfTextItem).str === 'string' &&
  Array.isArray((item as PdfTextItem).transform);

const computeFontSize = (item: PdfTextItem): number =>
  Math.max(
    Math.abs(item.height || 0),
    Math.abs(Number(item.transform[0]) || 0),
    Math.abs(Number(item.transform[3]) || 0),
    1
  );

const joinLineSegments = (
  segments: Array<{ text: string; x: number; width: number; fontSize: number }>
): string => {
  const sorted = [...segments].sort((a, b) => a.x - b.x);
  let text = '';
  let previous: (typeof sorted)[number] | null = null;

  for (const segment of sorted) {
    if (!previous) {
      text = segment.text;
      previous = segment;
      continue;
    }

    const gap = segment.x - (previous.x + previous.width);
    const shouldAddSpace =
      !text.endsWith('-') &&
      !/^[,.;:!?)]/.test(segment.text) &&
      gap > Math.max(1, previous.fontSize * 0.12);

    text += `${shouldAddSpace ? ' ' : ''}${segment.text}`;
    previous = segment;
  }

  return normalizeWhitespace(text);
};

const buildTextLines = (items: unknown[], pageNumber: number): PdfTextLine[] => {
  const segments = items
    .filter(isPdfTextItem)
    .map((item) => ({
      text: normalizeWhitespace(item.str),
      x: Number(item.transform[4]) || 0,
      y: Number(item.transform[5]) || 0,
      width: Math.abs(Number(item.width) || 0),
      fontSize: computeFontSize(item),
    }))
    .filter((item) => item.text.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Array<{
    y: number;
    x: number;
    fontSize: number;
    segments: Array<{ text: string; x: number; width: number; fontSize: number }>;
  }> = [];

  for (const segment of segments) {
    const lastRow = rows[rows.length - 1];
    const tolerance = Math.max(2, Math.max(lastRow?.fontSize ?? 0, segment.fontSize) * 0.45);

    if (lastRow && Math.abs(lastRow.y - segment.y) <= tolerance) {
      lastRow.segments.push(segment);
      lastRow.fontSize = Math.max(lastRow.fontSize, segment.fontSize);
      lastRow.x = Math.min(lastRow.x, segment.x);
    } else {
      rows.push({
        y: segment.y,
        x: segment.x,
        fontSize: segment.fontSize,
        segments: [segment],
      });
    }
  }

  return rows
    .map((row) => ({
      pageNumber,
      x: row.x,
      y: row.y,
      fontSize: row.fontSize,
      text: joinLineSegments(row.segments),
    }))
    .filter((row) => row.text.length > 0);
};

const getPageTextLines = async (
  pdfDocument: PdfDocumentLike,
  pageNumber: number
): Promise<PdfTextLine[]> => {
  const page = await pdfDocument.getPage(pageNumber);

  try {
    const textContent = await page.getTextContent({
      disableNormalization: false,
    });

    return buildTextLines(textContent.items, pageNumber);
  } finally {
    page.cleanup();
  }
};

const findSectionBreakIndex = (lines: PdfTextLine[]): number =>
  lines.findIndex((line) => SECTION_BREAK_PATTERN.test(line.text));

const isLikelyTitleLine = (text: string): boolean => {
  if (text.length < 12 || text.length > 220) {
    return false;
  }

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 3 || wordCount > 28) {
    return false;
  }

  if (TITLE_EXCLUSION_PATTERN.test(text)) {
    return false;
  }

  return /[\p{L}]/u.test(text);
};

const scoreTitleLine = (line: PdfTextLine, index: number): number => {
  const wordCount = line.text.split(/\s+/).length;
  let score = line.fontSize * 6;

  if (line.text.length >= 20 && line.text.length <= 180) {
    score += 18;
  }

  if (wordCount >= 4 && wordCount <= 24) {
    score += 10;
  }

  if (!/[.@]/.test(line.text)) {
    score += 4;
  }

  if (/^[A-Z0-9\s-]+$/.test(line.text) && line.text.length < 18) {
    score -= 18;
  }

  score += Math.max(0, 12 - index);
  return score;
};

const collectBlockText = (lines: PdfTextLine[], startIndex: number, endIndex: number): string =>
  normalizeWhitespace(lines.slice(startIndex, endIndex + 1).map((line) => line.text).join(' '));

const extractBodyTitleSelection = (pageLines: PdfTextLine[]): TextBlockSelection | null => {
  const sectionBreakIndex = findSectionBreakIndex(pageLines);
  const searchWindow =
    sectionBreakIndex === -1
      ? pageLines.slice(0, 14)
      : pageLines.slice(0, Math.min(sectionBreakIndex, 14));

  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < searchWindow.length; index += 1) {
    const line = searchWindow[index];
    if (!isLikelyTitleLine(line.text)) {
      continue;
    }

    const score = scoreTitleLine(line, index);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex === -1) {
    return null;
  }

  const baseLine = searchWindow[bestIndex];
  let startIndex = bestIndex;
  let endIndex = bestIndex;

  while (startIndex > 0) {
    const candidate = searchWindow[startIndex - 1];
    const yDistance = Math.abs(candidate.y - searchWindow[startIndex].y);

    if (
      isLikelyTitleLine(candidate.text) &&
      candidate.fontSize >= baseLine.fontSize * 0.75 &&
      yDistance <= baseLine.fontSize * 2.2
    ) {
      startIndex -= 1;
    } else {
      break;
    }
  }

  while (endIndex + 1 < searchWindow.length) {
    const candidate = searchWindow[endIndex + 1];
    const yDistance = Math.abs(candidate.y - searchWindow[endIndex].y);

    if (
      isLikelyTitleLine(candidate.text) &&
      candidate.fontSize >= baseLine.fontSize * 0.75 &&
      yDistance <= baseLine.fontSize * 2.2
    ) {
      endIndex += 1;
    } else {
      break;
    }
  }

  const title = sanitizeTitle(collectBlockText(searchWindow, startIndex, endIndex));
  if (!title) {
    return null;
  }

  return {
    text: title,
    startIndex,
    endIndex,
    fontSize: baseLine.fontSize,
  };
};

const isLikelyAuthorLine = (text: string): boolean => {
  if (text.length < 4 || text.length > 140) {
    return false;
  }

  if (AUTHOR_EXCLUSION_PATTERN.test(text)) {
    return false;
  }

  if (SECTION_BREAK_PATTERN.test(text) || TITLE_EXCLUSION_PATTERN.test(text)) {
    return false;
  }

  if (/^\d+$/.test(text)) {
    return false;
  }

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 2 || wordCount > 24) {
    return false;
  }

  return /[\p{L}]/u.test(text);
};

const scoreAuthorLine = (text: string, distanceFromTitle: number): number => {
  let score = 0;

  if (/[;,]/.test(text) || /\band\b/i.test(text)) {
    score += 12;
  }

  const capitalizedWordCount = text.match(/\b[\p{Lu}][\p{L}'-]+\b/gu)?.length ?? 0;
  if (capitalizedWordCount >= 2) {
    score += 10;
  }

  if (!/\d{4}/.test(text)) {
    score += 4;
  }

  score += Math.max(0, 8 - distanceFromTitle);
  return score;
};

const extractBodyAuthor = (
  pageLines: PdfTextLine[],
  titleSelection: TextBlockSelection | null
): string | null => {
  const sectionBreakIndex = findSectionBreakIndex(pageLines);
  const startIndex = titleSelection ? titleSelection.endIndex + 1 : 0;
  const endIndex =
    sectionBreakIndex === -1
      ? Math.min(pageLines.length, startIndex + 8)
      : Math.min(sectionBreakIndex, startIndex + 8);

  if (startIndex >= endIndex) {
    return null;
  }

  const candidateLines = pageLines.slice(startIndex, endIndex);
  let bestLocalIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < candidateLines.length; index += 1) {
    const line = candidateLines[index];
    if (!isLikelyAuthorLine(line.text)) {
      continue;
    }

    const score = scoreAuthorLine(line.text, index);
    if (score > bestScore) {
      bestScore = score;
      bestLocalIndex = index;
    }
  }

  if (bestLocalIndex === -1) {
    return null;
  }

  let blockStart = bestLocalIndex;
  let blockEnd = bestLocalIndex;
  const baseFont = candidateLines[bestLocalIndex].fontSize;

  while (blockStart > 0) {
    const candidate = candidateLines[blockStart - 1];
    if (isLikelyAuthorLine(candidate.text) && candidate.fontSize >= baseFont * 0.7) {
      blockStart -= 1;
    } else {
      break;
    }
  }

  while (blockEnd + 1 < candidateLines.length) {
    const candidate = candidateLines[blockEnd + 1];
    if (isLikelyAuthorLine(candidate.text) && candidate.fontSize >= baseFont * 0.7) {
      blockEnd += 1;
    } else {
      break;
    }
  }

  const authors = normalizeWhitespace(
    candidateLines
      .slice(blockStart, blockEnd + 1)
      .map((line) => line.text)
      .join(' ; ')
  );

  return authors || null;
};

const extractBodyYear = (lines: PdfTextLine[]): string | null => {
  const candidates: Array<{ year: string; score: number }> = [];

  for (const line of lines) {
    const yearMatches = Array.from(line.text.matchAll(new RegExp(YEAR_PATTERN, 'g'))).map(
      (match) => match[0]
    );
    if (yearMatches.length === 0) {
      continue;
    }

    let score = 0;

    if (YEAR_KEYWORD_PATTERN.test(line.text)) {
      score += 8;
    }

    if (line.pageNumber === 1) {
      score += 2;
    }

    if (line.text.length <= 160) {
      score += 1;
    }

    if (YEAR_PENALTY_PATTERN.test(line.text)) {
      score -= 6;
    }

    if (score <= 0) {
      continue;
    }

    for (const year of yearMatches) {
      candidates.push({ year, score });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].year;
};

const extractBodyFieldsFromPdf = async (pdfDocument: PdfDocumentLike): Promise<PdfBodyFields> => {
  const maxPages = Math.min(pdfDocument.numPages, 2);
  const pageLines: PdfTextLine[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const lines = await getPageTextLines(pdfDocument, pageNumber);
    pageLines.push(...lines);
  }

  const firstPageLines = pageLines.filter((line) => line.pageNumber === 1);
  const titleSelection = extractBodyTitleSelection(firstPageLines);

  return {
    title: titleSelection?.text ?? null,
    author: extractBodyAuthor(firstPageLines, titleSelection),
    year: extractBodyYear(pageLines),
  };
};

const extractDocumentMetadataFields = (
  info: Record<string, unknown>,
  metadata: PdfMetadataHandle,
  pdfDateString: PdfDateStringLike
): PdfMetadataFields => ({
  title:
    sanitizeTitle(
      getMetadataValue(metadata, ['dc:title', 'pdf:Title', 'xmp:Title']) ??
        getInfoValue(info, ['Title'])
    ) ?? null,
  author:
    getMetadataValue(metadata, ['dc:creator'], normalizeMetadataPeople) ??
    getInfoValue(info, ['Author'], normalizeMetadataPeople),
  year:
    extractYearFromValue(
      getMetadataValue(metadata, ['dc:date', 'prism:publicationDate']),
      pdfDateString
    ) ?? null,
});

const resolvePreferredField = (
  bodyValue: string | null,
  metadataValue: string | null
): ResolvedPdfField => {
  if (bodyValue) {
    return {
      value: bodyValue,
      source: 'body',
    };
  }

  if (metadataValue) {
    return {
      value: metadataValue,
      source: 'metadata',
    };
  }

  return {
    value: null,
    source: null,
  };
};

const resolvePreferredCleanName = (
  bodyTitle: string | null,
  filename: string,
  metadataTitle: string | null
): ResolvedNamingField => {
  const bodyCleanName = sanitizeTitle(bodyTitle);
  if (bodyCleanName) {
    return {
      value: bodyCleanName,
      source: 'body',
    };
  }

  const filenameCleanName = cleanFilename(filename).clean.trim();
  if (filenameCleanName) {
    return {
      value: filenameCleanName,
      source: 'filename',
    };
  }

  const metadataCleanName = sanitizeTitle(metadataTitle);
  if (metadataCleanName) {
    return {
      value: metadataCleanName,
      source: 'metadata',
    };
  }

  return {
    value: null,
    source: null,
  };
};

export const extractDateFromFilename = (filename: string): string => {
  const isoDate = filename.match(ISO_DATE_PATTERN);
  if (isoDate) {
    return isoDate[0];
  }

  const year = filename.match(YEAR_PATTERN);
  if (year) {
    return `${year[0]}-01-01`;
  }

  return new Date().toISOString().split('T')[0];
};

export const hasDateInFilename = (filename: string): boolean =>
  ISO_DATE_PATTERN.test(filename) || YEAR_PATTERN.test(filename);

export const extractNumberFromFilename = (filename: string): number | null => {
  const lastDotIndex = filename.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;

  return extractLeadingNumbering(nameWithoutExt).originalNumber;
};

export const cleanFilename = (filename: string): { clean: string; ext: string } => {
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  const nameWithoutExt = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;

  let clean = stripLeadingNumbering(nameWithoutExt);
  if (!clean) {
    clean = nameWithoutExt;
  }

  return { clean, ext };
};

const shouldRetryWithoutWorker = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /worker|GlobalWorkerOptions\.workerSrc|Setting up fake worker|Failed to fetch dynamically imported module|imported module|module script/i.test(
    error.message
  );
};

const parsePdfMetadata = async (
  file: File,
  useExplicitWorker = true
): Promise<PDFMetadataResult | null> => {
  const { pdfjs, workerUrl } = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  let pdfWorker: { destroy: () => void } | null = null;

  const loadingTask = (() => {
    if (!useExplicitWorker) {
      return pdfjs.getDocument({ data });
    }

    pdfWorker = pdfjs.PDFWorker.create({
      port: new Worker(workerUrl, { type: 'module' }),
    }) as unknown as { destroy: () => void };

    return pdfjs.getDocument({
      data,
      worker: pdfWorker as never,
    });
  })();

  try {
    const pdfDocument = (await loadingTask.promise) as unknown as PdfDocumentLike;
    const { info, metadata } = await pdfDocument.getMetadata();

    const bodyFields = await extractBodyFieldsFromPdf(pdfDocument);
    const metadataFields = extractDocumentMetadataFields(info, metadata, pdfjs.PDFDateString);
    const resolvedTitle = resolvePreferredField(bodyFields.title, metadataFields.title);
    const resolvedAuthor = resolvePreferredField(bodyFields.author, metadataFields.author);
    const resolvedYear = resolvePreferredField(bodyFields.year, metadataFields.year);
    const resolvedCleanName = resolvePreferredCleanName(
      bodyFields.title,
      file.name,
      metadataFields.title
    );

    await pdfDocument.destroy();

    if (
      !resolvedTitle.value &&
      !resolvedAuthor.value &&
      !resolvedYear.value &&
      !resolvedCleanName.value
    ) {
      return null;
    }

    return {
      title: resolvedTitle.value,
      bodyTitle: bodyFields.title,
      metadataTitle: metadataFields.title,
      author: resolvedAuthor.value,
      year: resolvedYear.value,
      cleanName: resolvedCleanName.value,
      titleSource: resolvedTitle.source,
      authorSource: resolvedAuthor.source,
      yearSource: resolvedYear.source,
      cleanNameSource: resolvedCleanName.source,
    };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
    pdfWorker?.destroy();
  }
};

export const extractMetadataFromPDF = async (file: File): Promise<PDFMetadataResult | null> => {
  const isPdfFile = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdfFile) {
    return null;
  }

  try {
    return await parsePdfMetadata(file);
  } catch (error) {
    if (shouldRetryWithoutWorker(error)) {
      try {
        return await parsePdfMetadata(file, false);
      } catch (fallbackError) {
        console.warn(`Failed to parse PDF data for "${file.name}".`, fallbackError);
        return null;
      }
    }

    console.warn(`Failed to parse PDF data for "${file.name}".`, error);
    return null;
  }
};

export const generateNewFilename = (
  file: ResearchFile,
  index: number,
  rule: RenamingRule
): string => {
  let num: number;

  if (rule.mode === 'offset') {
    const baseNum = file.originalNumber !== null ? file.originalNumber : 0;
    num = baseNum + rule.offsetValue;
    if (num < 0) {
      num = 0;
    }
  } else {
    num = rule.startNumber + index;
  }

  const numStr = num.toString().padStart(rule.minDigits, '0');
  let prefixPart = '';

  switch (rule.formatType) {
    case NumberFormat.Brackets:
      prefixPart = `[${numStr}]`;
      break;
    case NumberFormat.Dot:
      prefixPart = `${numStr}.`;
      break;
    case NumberFormat.Underscore:
      prefixPart = `${numStr}_`;
      break;
    case NumberFormat.Hyphen:
      prefixPart = `${numStr}-`;
      break;
    case NumberFormat.Custom:
      prefixPart = `${rule.customPrefix}${numStr}`;
      break;
  }

  return `${prefixPart}${rule.customSuffix}${file.cleanName}${file.extension}`;
};

export const generateSequenceNumberLabel = (
  file: ResearchFile,
  index: number,
  rule: RenamingRule
): string => {
  let num: number;

  if (rule.mode === 'offset') {
    const baseNum = file.originalNumber !== null ? file.originalNumber : 0;
    num = baseNum + rule.offsetValue;
    if (num < 0) {
      num = 0;
    }
  } else {
    num = rule.startNumber + index;
  }

  return num.toString().padStart(rule.minDigits, '0');
};

const escapeCsvValue = (value: string): string => {
  const normalized = value.replace(/\r?\n/g, ' ');
  const escaped = normalized.replace(/"/g, '""');

  if (/[",\n]/.test(normalized)) {
    return `"${escaped}"`;
  }

  return escaped;
};

export const generateResearchListCsv = (
  files: ResearchFile[],
  rule: RenamingRule
): string => {
  const headers = ['编号', '文件名', '时间'];
  const rows = files.map((file, index) =>
    [
      generateSequenceNumberLabel(file, index, rule),
      `${file.cleanName}${file.extension}`,
      file.publicationDate,
    ]
      .map((value) => escapeCsvValue(value))
      .join(',')
  );

  return [headers.join(','), ...rows].join('\r\n');
};
