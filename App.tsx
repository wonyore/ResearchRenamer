import React, { useState, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { 
  ResearchFile, 
  RenamingRule, 
  NumberFormat, 
  SortOrder 
} from './types';
import { extractDateFromFilename, cleanFilename, generateNewFilename, extractNumberFromFilename } from './utils/fileUtils';
import { Toolbar } from './components/Toolbar';
import { FileTable } from './components/FileTable';
import { UploadCloud, Download, FileArchive, RefreshCw } from './components/IconComponents';

const App: React.FC = () => {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Default Configuration
  const [rule, setRule] = useState<RenamingRule>({
    mode: 'sequential',
    startNumber: 1,
    offsetValue: 0,
    formatType: NumberFormat.Brackets,
    customPrefix: 'P',
    customSuffix: ' ',
    minDigits: 2,
  });

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: ResearchFile[] = Array.from(e.target.files).map((file: File) => {
        const { clean, ext } = cleanFilename(file.name);
        const extractedDate = extractDateFromFilename(file.name);
        const extractedNumber = extractNumberFromFilename(file.name);
        
        return {
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          originalFile: file,
          originalName: file.name,
          cleanName: clean,
          extension: ext,
          publicationDate: extractedDate,
          manualOverride: false,
          originalNumber: extractedNumber
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);
      
      // If user is uploading new files and we are in offset mode, 
      // they probably want to see them sorted by existing number by default if possible,
      // but 'newest' is a safe default. 
      // However, if we switch to offset mode, we might want to auto-switch sort order.
      // We'll handle that in the effect or render logic.
    }
    // Reset input
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileDate = (id: string, date: string) => {
    setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, publicationDate: date, manualOverride: true } : f
    ));
  };

  const resetAll = () => {
    if(confirm('Are you sure you want to clear all files?')) {
        setFiles([]);
    }
  };

  // Sort Files Logic
  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    
    // If we are in 'Offset' mode and user hasn't manually picked a sort, 
    // it makes sense to default to 'Number' sort implicitly, 
    // but explicit sort control is better.
    // We will just follow the selected sortOrder.
    
    sorted.sort((a, b) => {
        if (sortOrder === 'name') {
            return a.cleanName.localeCompare(b.cleanName);
        }
        
        if (sortOrder === 'number') {
             // Sort by extracted number. 
             const numA = a.originalNumber ?? Number.MAX_SAFE_INTEGER;
             const numB = b.originalNumber ?? Number.MAX_SAFE_INTEGER;
             return numA - numB;
        }
        
        const dateA = new Date(a.publicationDate).getTime();
        const dateB = new Date(b.publicationDate).getTime();
        
        if (sortOrder === 'newest') return dateB - dateA; // Desc
        return dateA - dateB; // Asc
    });
    return sorted;
  }, [files, sortOrder]);

  // Export Logic
  const handleExport = async () => {
    if (sortedFiles.length === 0) return;
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
        link.download = `Renamed_Research_Files_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Export failed", err);
        alert("Export failed. Please try again.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary-600 p-2 rounded-lg">
                <FileArchive className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">ResearchRenamer</h1>
                <p className="text-xs text-slate-500 hidden sm:block">科研成果文件编号批量管理应用</p>
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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
            
          {/* Left: Configuration Sidebar */}
          <aside className="w-full lg:w-80 flex-shrink-0 order-2 lg:order-1">
             <Toolbar rule={rule} setRule={setRule} fileCount={files.length} />
          </aside>

          {/* Right: Main Workspace */}
          <section className="flex-1 flex flex-col gap-6 order-1 lg:order-2">
            
            {/* Upload Area (Conditional) */}
            {files.length === 0 ? (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white p-12 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-all cursor-pointer group relative">
                    <input 
                        type="file" 
                        multiple 
                        onChange={handleFileUpload} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                    />
                    <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">拖拽或点击上传科研成果文件</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                        支持 PDF, DOCX, JPG, PNG。
                    </p>
                    <div className="flex gap-4 justify-center mt-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><UploadCloud className="w-3 h-3" /> 批量导入</span>
                        <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> 自动排序</span>
                        <span className="flex items-center gap-1"><Download className="w-3 h-3" /> 一键打包</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Action Bar for Non-empty state */}
                    <div className="flex justify-between items-center">
                         <div className="relative overflow-hidden group">
                            <button className="flex items-center gap-2 bg-white border border-slate-300 hover:border-primary-500 hover:text-primary-600 text-slate-700 px-4 py-2 rounded-lg shadow-sm transition-all font-medium text-sm">
                                <UploadCloud className="w-4 h-4" />
                                添加更多文件 (Add Files)
                            </button>
                            <input 
                                type="file" 
                                multiple 
                                onChange={handleFileUpload} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                            />
                        </div>

                        <button 
                            onClick={handleExport}
                            disabled={isProcessing}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg shadow-md font-medium text-white transition-all
                                ${isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 hover:shadow-lg'}
                            `}
                        >
                            {isProcessing ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {isProcessing ? 'Processing...' : '导出重命名文件 (ZIP)'}
                        </button>
                    </div>

                    {/* The File List Table */}
                    <div className="flex-1 min-h-[500px]">
                        <FileTable 
                            files={sortedFiles} 
                            rule={rule} 
                            onRemove={removeFile}
                            onDateChange={updateFileDate}
                            sortOrder={sortOrder}
                            onSortChange={setSortOrder}
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