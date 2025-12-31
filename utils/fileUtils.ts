import { ResearchFile, NumberFormat, RenamingRule } from '../types';

/**
 * Extract likely publication year/date from filename.
 * Looks for patterns like 2023, 2024-01-01, etc.
 */
export const extractDateFromFilename = (filename: string): string => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Match YYYY-MM-DD
  const isoDate = filename.match(/\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (isoDate) return isoDate[0];

  // Match YYYY
  const year = filename.match(/\b(19|20)\d{2}\b/);
  if (year) {
    // Default to Jan 1st of that year for sorting purposes if only year is found
    return `${year[0]}-01-01`;
  }

  return today;
};

/**
 * Extracts the leading number from a filename if present.
 * e.g. "[1] Paper" -> 1, "05_Paper" -> 5
 */
export const extractNumberFromFilename = (filename: string): number | null => {
  // Regex looks for number at start, optionally wrapped in brackets/parens or followed by delimiters
  // 1. [01], (1)
  // 2. 01., 01_, 01-
  // 3. P01, No.1
  const match = filename.match(/^(\[|\(|P|No\.?)?\s*(\d{1,5})(\]|\)|\.|_|-|\s)/i);
  
  if (match && match[2]) {
    return parseInt(match[2], 10);
  }
  return null;
};

/**
 * Removes common numbering patterns from the start of filenames.
 * e.g., "[1] Title" -> "Title", "01_Title" -> "Title"
 */
export const cleanFilename = (filename: string): { clean: string, ext: string } => {
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  const nameWithoutExt = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;

  // Regex to strip start numbers:
  // 1. [01], (1), [12]
  // 2. 01_, 1., 1-
  // 3. P01_, v1_
  let clean = nameWithoutExt
    .replace(/^(\[|\()?(\d{1,5})(\]|\))?[\s._-]*/, '') // Handles [1], (1), 1
    .replace(/^(P|V|No\.?)?[-_]?\d{1,5}[-_.\s]+/, '') // Handles P01, No.1
    .trim();

  // If the cleanup resulted in empty string (filename was just a number), revert
  if (!clean) clean = nameWithoutExt;

  return { clean, ext };
};

export const generateNewFilename = (
  file: ResearchFile,
  index: number,
  rule: RenamingRule
): string => {
  let num: number;

  if (rule.mode === 'offset') {
    // If original number exists, add offset. Otherwise, fallback to 0 + offset or keep raw logic?
    // Let's assume 0 if not found so user sees it needs fixing, or use 0.
    const baseNum = file.originalNumber !== null ? file.originalNumber : 0;
    num = baseNum + rule.offsetValue;
    // Prevent negative numbers if desired, or allow them. User requested + or -, so negatives might happen if offset is large negative.
    // Generally file numbers are > 0. Let's floor at 0 or 1? 
    // User requirement: "Increase or decrease". Let's allow whatever result comes out, but standard numbering is usually positive.
    if (num < 0) num = 0; 
  } else {
    // Sequential Mode
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

  // Ensure separator isn't double applied if the format implies it
  const separator = rule.customSuffix; 
  
  return `${prefixPart}${separator}${file.cleanName}${file.extension}`;
};
