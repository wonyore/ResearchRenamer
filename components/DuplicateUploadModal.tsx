import React, { useEffect } from 'react';
import { AlertTriangle, Check, X } from './IconComponents';

interface DuplicateUploadModalProps {
  duplicatedNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DuplicateUploadModal: React.FC<DuplicateUploadModalProps> = ({
  duplicatedNames,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-upload-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 id="duplicate-upload-title" className="text-xl font-semibold text-slate-900">
                检测到重复原始文件名
              </h2>
              <p className="text-sm leading-6 text-slate-500">
                以下文件名与当前列表或本次上传中的其他文件重复。你可以继续上传，也可以取消本次操作。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭重复文件名提醒"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            重复文件名数量：<span className="font-semibold">{duplicatedNames.length}</span>
          </div>

          <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70">
            <ul className="divide-y divide-slate-200/80">
              {duplicatedNames.map((name) => (
                <li key={name} className="px-4 py-3 text-sm leading-6 text-slate-700">
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm leading-6 text-primary-900">
            继续上传后，这些文件会照常进入列表；如果生成名称也重复，表格中仍会继续显示高亮提醒。
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
          >
            取消上传
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            <Check className="h-4 w-4" />
            继续上传
          </button>
        </div>
      </div>
    </div>
  );
};
