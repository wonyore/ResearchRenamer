import React, { startTransition, useCallback, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { arrayMove } from '@dnd-kit/sortable';
import {
  NamingSource,
  NumberFormat,
  PDFMetadataResult,
  RenamingRule,
  ResearchFile,
  SortOrder,
} from './types';
import {
  cleanFilename,
  extractDateFromFilename,
  extractMetadataFromPDF,
  extractNumberFromFilename,
  generateNewFilename,
  generateResearchListCsv,
} from './utils/fileUtils';
import { FileTable } from './components/FileTable';
import { Toolbar } from './components/Toolbar';
import { Download, FileArchive, RefreshCw, UploadCloud } from './components/IconComponents';

const resolveActiveCleanName = (
  file: Pick<ResearchFile, 'filenameCleanName' | 'pdfMetadata'>,
  preferredSource: NamingSource,
  metadataOverride?: PDFMetadataResult | null
): { cleanName: string; nameSource: NamingSource } => {
  const metadata = metadataOverride ?? file.pdfMetadata;

  if (preferredSource === 'body' && metadata?.bodyTitle) {
    return {
      cleanName: metadata.bodyTitle,
      nameSource: 'body',
    };
  }

  if (preferredSource === 'metadata' && metadata?.metadataTitle) {
    return {
      cleanName: metadata.metadataTitle,
      nameSource: 'metadata',
    };
  }

  return {
    cleanName: file.filenameCleanName,
    nameSource: 'filename',
  };
};

const getDuplicateNameKey = (file: Pick<ResearchFile, 'cleanName' | 'extension'>) =>
  `${file.cleanName.trim().toLocaleLowerCase()}::${file.extension.trim().toLocaleLowerCase()}`;

const App: React.FC = () => {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [isProcessing, setIsProcessing] = useState(false);

  const [rule, setRule] = useState<RenamingRule>({
    mode: 'sequential',
    startNumber: 1,
    offsetValue: 0,
    formatType: NumberFormat.Brackets,
    customPrefix: 'P',
    customSuffix: ' ',
    minDigits: 2,
  });

  const applyPdfMetadata = useCallback((id: string, metadata: PDFMetadataResult) => {
    startTransition(() => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === id
            ? (() => {
                const resolvedNaming = resolveActiveCleanName(file, file.nameSource, metadata);

                return {
                  ...file,
                  cleanName: resolvedNaming.cleanName,
                  nameSource: resolvedNaming.nameSource,
                  pdfMetadata: metadata,
                  pdfMetadataStatus: 'parsed',
                };
              })()
            : file
        )
      );
    });
  }, []);

  const markPdfMetadataUnavailable = useCallback((id: string) => {
    startTransition(() => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === id
            ? {
                ...file,
                pdfMetadataStatus: 'unavailable',
              }
            : file
        )
      );
    });
  }, []);

  const hydratePdfMetadata = useCallback(
    async (pendingFiles: ResearchFile[]) => {
      for (const file of pendingFiles) {
        const isPdfFile =
          file.originalFile.type === 'application/pdf' || file.extension.toLowerCase() === '.pdf';

        if (!isPdfFile) {
          continue;
        }

        const metadata = await extractMetadataFromPDF(file.originalFile);
        if (metadata) {
          applyPdfMetadata(file.id, metadata);
        } else {
          markPdfMetadataUnavailable(file.id);
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
      }
    },
    [applyPdfMetadata, markPdfMetadataUnavailable]
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files ? Array.from(event.target.files) : [];

    if (uploadedFiles.length > 0) {
      const newFiles: ResearchFile[] = uploadedFiles.map((file) => {
        const { clean, ext } = cleanFilename(file.name);
        const extractedDate = extractDateFromFilename(file.name);
        const extractedNumber = extractNumberFromFilename(file.name);

        return {
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          originalFile: file,
          originalName: file.name,
          filenameCleanName: clean,
          cleanName: clean,
          extension: ext,
          duplicatedName: false,
          publicationDate: extractedDate,
          manualOverride: false,
          originalNumber: extractedNumber,
          nameSource: 'filename',
          pdfMetadata: null,
          pdfMetadataStatus:
            file.type === 'application/pdf' || ext.toLowerCase() === '.pdf' ? 'pending' : null,
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);
      void hydratePdfMetadata(newFiles);
    }

    event.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const updateFileDate = (id: string, date: string) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, publicationDate: date, manualOverride: true } : file
      )
    );
  };

  const reorderFiles = useCallback((activeId: string, overId: string) => {
    setFiles((prev) => {
      const oldIndex = prev.findIndex((file) => file.id === activeId);
      const newIndex = prev.findIndex((file) => file.id === overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return prev;
      }

      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const updateFileNameSource = useCallback((id: string, nextSource: NamingSource) => {
    startTransition(() => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === id
            ? (() => {
                const resolvedNaming = resolveActiveCleanName(file, nextSource);

                return {
                  ...file,
                  cleanName: resolvedNaming.cleanName,
                  nameSource: resolvedNaming.nameSource,
                };
              })()
            : file
        )
      );
    });
  }, []);

  const resetAll = () => {
    if (confirm('确定要清空全部文件吗？')) {
      setFiles([]);
    }
  };

  const sortedFiles = useMemo(() => {
    const sorted = sortOrder === 'manual' ? [...files] : [...files];

    if (sortOrder !== 'manual') {
      sorted.sort((a, b) => {
        if (sortOrder === 'name') {
          return a.cleanName.localeCompare(b.cleanName);
        }

        if (sortOrder === 'number') {
          const numA = a.originalNumber ?? Number.MAX_SAFE_INTEGER;
          const numB = b.originalNumber ?? Number.MAX_SAFE_INTEGER;
          return numA - numB;
        }

        const dateA = new Date(a.publicationDate).getTime();
        const dateB = new Date(b.publicationDate).getTime();

        if (sortOrder === 'newest') {
          return dateB - dateA;
        }

        return dateA - dateB;
      });
    }

    const duplicateCounts = new Map<string, number>();

    sorted.forEach((file) => {
      const duplicateKey = getDuplicateNameKey(file);
      duplicateCounts.set(duplicateKey, (duplicateCounts.get(duplicateKey) ?? 0) + 1);
    });

    return sorted.map((file) => {
      const duplicateKey = getDuplicateNameKey(file);

      return {
        ...file,
        duplicatedName: (duplicateCounts.get(duplicateKey) ?? 0) > 1,
      };
    });
  }, [files, sortOrder]);

  const handleCsvExport = () => {
    if (sortedFiles.length === 0 || isProcessing) {
      return;
    }

    try {
      const csvContent = generateResearchListCsv(sortedFiles, rule);
      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Research_List_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV export failed', error);
      alert('CSV 导出失败，请重试。');
    }
  };

  const handleZipExport = async () => {
    if (sortedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);

    try {
      const zip = new JSZip();

      sortedFiles.forEach((file, index) => {
        const newName = generateNewFilename(file, index, rule);
        zip.file(newName, file.originalFile);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Renamed_Research_Files_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('ZIP export failed', error);
      alert('ZIP 导出失败，请重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-lg">
              <FileArchive className="w-5 h-5 text-white" />
            </div>
            <div className="inline-flex min-w-0 flex-col">
              <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900">
                ResearchRenamer
              </h1>
              <div className="mt-1 hidden w-full items-center justify-between text-[11px] font-medium leading-none text-slate-500 sm:flex">
                <span>科研成果</span>
                <span>文件智能</span>
                <span>编号与</span>
                <span>命名系统</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {files.length > 0 && (
              <button
                onClick={resetAll}
                className="text-slate-500 hover:text-slate-700 px-3 py-2 text-sm font-medium transition-colors"
              >
                清空 (Clear)
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="w-full lg:w-80 flex-shrink-0 order-2 lg:order-1">
            <Toolbar
              rule={rule}
              setRule={setRule}
              fileCount={files.length}
              sortOrder={sortOrder}
            />
          </aside>

          <section className="flex-1 flex flex-col gap-6 order-1 lg:order-2">
            {files.length === 0 ? (
              <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white p-12 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-all cursor-pointer group relative">
                <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  点击或拖拽文件到这里开始管理
                </h3>
                <p className="text-slate-500 max-w-md mx-auto">支持 PDF、DOCX、DOC、JPG、PNG</p>
                <div className="flex gap-4 justify-center mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" />
                    批量上传
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    灵活排序
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    导出结果
                  </span>
                </div>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div className="relative overflow-hidden group">
                    <button className="flex h-11 items-center gap-2 bg-white border border-slate-300 hover:border-primary-500 hover:text-primary-600 text-slate-700 px-4 rounded-lg shadow-sm transition-all font-medium text-sm">
                      <UploadCloud className="w-4 h-4" />
                      添加更多文件 (Add Files)
                    </button>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                    />
                  </div>

                    <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleCsvExport}
                      disabled={isProcessing}
                      className={`flex h-11 items-center gap-2 px-4 rounded-lg border font-medium transition-all text-sm ${
                        isProcessing
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      导出科研成果清单 (CSV)
                    </button>

                    <button
                      onClick={handleZipExport}
                      disabled={isProcessing}
                      className={`flex h-11 items-center gap-2 px-6 rounded-lg shadow-md font-medium text-white transition-all ${
                        isProcessing
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-primary-600 hover:bg-primary-700 hover:shadow-lg'
                      }`}
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isProcessing ? '处理中...' : '导出重命名文件 (ZIP)'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-[500px]">
                  <FileTable
                    files={sortedFiles}
                    rule={rule}
                    onRemove={removeFile}
                    onDateChange={updateFileDate}
                    onReorder={reorderFiles}
                    sortOrder={sortOrder}
                    onSortChange={setSortOrder}
                    onNameSourceChange={updateFileNameSource}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
