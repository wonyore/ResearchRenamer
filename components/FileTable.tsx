import React from 'react';
import { ResearchFile, RenamingRule, SortOrder } from '../types';
import { generateNewFilename } from '../utils/fileUtils';
import { FileText, Trash2, Calendar, ArrowUpDown } from './IconComponents';

interface FileTableProps {
  files: ResearchFile[];
  rule: RenamingRule;
  onRemove: (id: string) => void;
  onDateChange: (id: string, date: string) => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
}

export const FileTable: React.FC<FileTableProps> = ({ 
  files, 
  rule, 
  onRemove, 
  onDateChange,
  sortOrder,
  onSortChange
}) => {
  if (files.length === 0) {
    return null;
  }

  const toggleSort = () => {
    if (sortOrder === 'newest') onSortChange('oldest');
    else if (sortOrder === 'oldest') onSortChange('number');
    else if (sortOrder === 'number') onSortChange('name');
    else onSortChange('newest');
  };

  const getSortLabel = () => {
    switch(sortOrder) {
        case 'newest': return '最新优先 (Date Desc)';
        case 'oldest': return '最旧优先 (Date Asc)';
        case 'name': return '文件名 (Name)';
        case 'number': return '原有编号 (Original Num)';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          文件列表 ({files.length})
        </h3>
        
        <button 
            onClick={toggleSort}
            className="flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-md transition-colors"
        >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>排序: {getSortLabel()}</span>
        </button>
      </div>

      {/* List */}
      <div className="overflow-auto flex-1 p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              {rule.mode === 'sequential' ? (
                  <th className="px-6 py-3 border-b border-slate-200">发表时间 (Date)</th>
              ) : (
                  <th className="px-6 py-3 border-b border-slate-200">原编号 (Num)</th>
              )}
              <th className="px-6 py-3 border-b border-slate-200 w-1/3">原文件名 (Original)</th>
              <th className="px-6 py-3 border-b border-slate-200 w-1/3 text-primary-700">预览新文件名 (Preview)</th>
              <th className="px-6 py-3 border-b border-slate-200 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {files.map((file, index) => {
              const newName = generateNewFilename(file, index, rule);
              return (
                <tr key={file.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-3">
                    {rule.mode === 'sequential' ? (
                        <div className="relative flex items-center">
                            <Calendar className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                            <input 
                                type="date"
                                value={file.publicationDate}
                                onChange={(e) => onDateChange(file.id, e.target.value)}
                                className={`pl-7 pr-2 py-1 rounded border text-sm w-36 focus:ring-1 focus:ring-primary-500 focus:border-primary-500
                                    ${file.manualOverride ? 'border-primary-300 bg-primary-50 text-primary-800 font-medium' : 'border-slate-200 text-slate-600'}
                                `}
                            />
                        </div>
                    ) : (
                        <div className="text-sm font-mono font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
                            {file.originalNumber !== null ? file.originalNumber : '-'}
                        </div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-sm text-slate-500 truncate max-w-[250px]" title={file.originalName}>
                        {file.originalName}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-slate-800 truncate max-w-[250px] bg-slate-100/50 px-2 py-1 rounded select-all" title={newName}>
                        {newName}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button 
                        onClick={() => onRemove(file.id)}
                        className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Remove file"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer / Empty State for table */}
      {files.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center">
            {rule.mode === 'sequential' 
                ? "Tip: 修改日期以调整排序，或切换至「平移跳号」模式保留原编号间隔" 
                : "Tip: 系统自动识别文件名开头的数字作为原编号"
            }
          </div>
      )}
    </div>
  );
};
