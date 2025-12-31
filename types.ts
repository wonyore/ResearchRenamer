export interface ResearchFile {
  id: string;
  originalFile: File;
  originalName: string; // The full original filename
  cleanName: string; // Filename stripped of old numbers
  extension: string; // .pdf, .docx
  publicationDate: string; // ISO Date string YYYY-MM-DD
  manualOverride: boolean; // If true, user manually set the date
  originalNumber: number | null; // Extracted existing number, null if none found
}

export type RenamingMode = 'sequential' | 'offset';

export interface RenamingRule {
  mode: RenamingMode;
  startNumber: number; // For sequential mode
  offsetValue: number; // For offset mode (+2, -1 etc)
  formatType: NumberFormat;
  customPrefix: string;
  customSuffix: string; // Separator between number and title
  minDigits: number; // Padding, e.g., 2 for '01'
}

export enum NumberFormat {
  Brackets = '[N]',    // [01]
  Dot = 'N.',          // 1.
  Underscore = 'N_',   // 01_
  Hyphen = 'N-',       // 1-
  Custom = 'CUSTOM',   // Uses prefix
}

export type SortOrder = 'newest' | 'oldest' | 'name' | 'number';
