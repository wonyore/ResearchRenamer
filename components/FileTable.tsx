import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NamingSource, ResearchFile, RenamingRule, SortOrder } from '../types';
import { generateNewFilename } from '../utils/fileUtils';
import { ArrowUpDown, Calendar, FileText, Menu, Trash2 } from './IconComponents';

interface FileTableProps {
  files: ResearchFile[];
  rule: RenamingRule;
  onRemove: (id: string) => void;
  onDateChange: (id: string, date: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  onNameSourceChange: (id: string, source: NamingSource) => void;
}

interface SortableRowProps {
  file: ResearchFile;
  index: number;
  rule: RenamingRule;
  isManualSort: boolean;
  onRemove: (id: string) => void;
  onDateChange: (id: string, date: string) => void;
  onNameSourceChange: (id: string, source: NamingSource) => void;
}

interface HeaderLabelProps {
  zh: string;
  en: string;
  align?: 'left' | 'center' | 'right';
  accent?: boolean;
}

interface ExpandableTextProps {
  value: string;
  tone?: 'muted' | 'strong';
  highlight?: boolean;
  collapsedLines?: 1 | 2;
}

const metadataStatusStyles: Record<'pending' | 'parsed' | 'unavailable', string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  parsed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unavailable: 'bg-slate-100 text-slate-600 border-slate-200',
};

const metadataStatusLabels: Record<'pending' | 'parsed' | 'unavailable', string> = {
  pending: 'PDF解析中 / PDF Parsing',
  parsed: 'PDF已解析 / PDF Parsed',
  unavailable: '无PDF数据 / No PDF Data',
};

const namingSourceOptions: Array<{
  value: NamingSource;
  zh: string;
  en: string;
}> = [
  { value: 'filename', zh: '文件名', en: 'Filename' },
  { value: 'body', zh: '正文标题', en: 'Body Title' },
  { value: 'metadata', zh: '元数据标题', en: 'Metadata Title' },
];

const multilineClampClass =
  'overflow-hidden break-words [display:-webkit-box] [-webkit-box-orient:vertical]';

const HeaderLabel: React.FC<HeaderLabelProps> = ({
  zh,
  en,
  align = 'left',
  accent = false,
}) => {
  const alignmentClass =
    align === 'center'
      ? 'items-center text-center'
      : align === 'right'
        ? 'items-end text-right'
        : 'items-start text-left';

  return (
    <div className={`flex flex-col gap-0.5 leading-tight ${alignmentClass}`}>
      <span className={accent ? 'font-semibold text-primary-700' : 'font-semibold text-slate-700'}>
        {zh}
      </span>
      <span className="text-[11px] font-medium normal-case tracking-normal text-slate-400">
        {en}
      </span>
    </div>
  );
};

const ExpandableText: React.FC<ExpandableTextProps> = ({
  value,
  tone = 'muted',
  highlight = false,
  collapsedLines = 1,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = value.length > 48 || value.includes('\n');

  const wrapperClass =
    tone === 'strong'
      ? `rounded-md px-2 py-1 ${highlight ? 'bg-slate-100/60' : 'bg-transparent'}`
      : 'rounded-md';

  const textClass =
    tone === 'strong'
      ? 'text-sm font-medium text-slate-800 leading-5'
      : 'text-sm text-slate-500 leading-5';

  const hoverClass = isExpandable
    ? tone === 'strong'
      ? 'cursor-pointer hover:bg-slate-100'
      : 'cursor-pointer hover:bg-slate-50'
    : '';

  const collapsedClass =
    collapsedLines === 1
      ? 'overflow-hidden text-ellipsis whitespace-nowrap'
      : `${multilineClampClass} [-webkit-line-clamp:2]`;

  const title = isExpandable
    ? expanded
      ? '点击收起完整文件名 / Click to collapse full name'
      : '点击展开完整文件名 / Click to expand full name'
    : value;

  return (
    <button
      type="button"
      onClick={isExpandable ? () => setExpanded((prev) => !prev) : undefined}
      disabled={!isExpandable}
      title={title}
      className={`group block w-full text-left transition-colors ${isExpandable ? '' : 'cursor-default'}`}
    >
      <div className={`${wrapperClass} ${hoverClass}`}>
        <div className="flex items-start gap-2">
          <div
            className={`min-w-0 flex-1 break-words select-text ${
              !expanded && isExpandable ? collapsedClass : ''
            } ${textClass}`}
          >
            {value}
          </div>
          {isExpandable && (
            <span className="shrink-0 pt-0.5 text-[10px] font-medium text-primary-600 opacity-80 group-hover:opacity-100">
              {expanded ? '收起' : '展开'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const SortableRow: React.FC<SortableRowProps> = ({
  file,
  index,
  rule,
  isManualSort,
  onRemove,
  onDateChange,
  onNameSourceChange,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.id,
    disabled: !isManualSort,
  });

  const newName = generateNewFilename(file, index, rule);
  const metadataSummary = [
    file.pdfMetadata?.title
      ? `Title (${file.pdfMetadata.titleSource ?? 'unknown'}): ${file.pdfMetadata.title}`
      : null,
    file.pdfMetadata?.author
      ? `Author (${file.pdfMetadata.authorSource ?? 'unknown'}): ${file.pdfMetadata.author}`
      : null,
    file.pdfMetadata?.year
      ? `Year (${file.pdfMetadata.yearSource ?? 'unknown'}): ${file.pdfMetadata.year}`
      : null,
  ].filter((item): item is string => Boolean(item));

  const sourceAvailability: Record<NamingSource, boolean> = {
    filename: true,
    body: Boolean(file.pdfMetadata?.bodyTitle),
    metadata: Boolean(file.pdfMetadata?.metadataTitle),
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group transition-colors ${
        isDragging
          ? 'bg-primary-50 shadow-lg relative z-20'
          : file.duplicatedName
            ? 'bg-red-50/70 hover:bg-red-100/60'
            : 'hover:bg-slate-50/80'
      }`}
    >
      <td className="px-4 py-3 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={!isManualSort}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            isManualSort
              ? 'border-slate-200 bg-white text-slate-400 hover:border-primary-300 hover:text-primary-600 cursor-grab active:cursor-grabbing'
              : 'border-transparent bg-transparent text-slate-200 cursor-not-allowed'
          }`}
          title={
            isManualSort
              ? '拖拽调整顺序 / Drag to reorder'
              : '切换到手动排序后可拖拽 / Switch to manual sort to drag'
          }
        >
          <Menu className="w-4 h-4" />
        </button>
      </td>
      <td className="px-6 py-3">
        {rule.mode === 'sequential' ? (
          <div className="relative flex items-center">
            <Calendar className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
            <input
              type="date"
              value={file.publicationDate}
              onChange={(e) => onDateChange(file.id, e.target.value)}
              className={`pl-7 pr-2 py-1 rounded border text-sm w-36 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                file.manualOverride
                  ? 'border-primary-300 bg-primary-50 text-primary-800 font-medium'
                  : 'border-slate-200 text-slate-600'
              }`}
            />
          </div>
        ) : (
          <div className="text-sm font-mono font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
            {file.originalNumber !== null ? file.originalNumber : '-'}
          </div>
        )}
      </td>
      <td className="px-6 py-3">
        <div className="space-y-1.5 min-w-0">
          <ExpandableText value={file.originalName} collapsedLines={1} />
          {file.pdfMetadataStatus && (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${metadataStatusStyles[file.pdfMetadataStatus]}`}
              >
                {metadataStatusLabels[file.pdfMetadataStatus]}
              </span>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
              <span className="text-[11px] text-slate-500">来源 / Source</span>
              <select
                value={file.nameSource}
                onChange={(e) => onNameSourceChange(file.id, e.target.value as NamingSource)}
                className="bg-transparent text-[11px] font-medium text-slate-700 outline-none"
              >
                {namingSourceOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={!sourceAvailability[option.value]}
                  >
                    {option.zh} / {option.en}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <ExpandableText value={newName} tone="strong" highlight collapsedLines={1} />
            </div>
            {file.duplicatedName && (
              <span className="inline-flex shrink-0 items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                ⚠ Duplicate
              </span>
            )}
          </div>
          {metadataSummary.length > 0 && (
            <div
              className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-500 leading-5"
              title={metadataSummary.join(' | ')}
            >
              {metadataSummary.join(' | ')}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-3 text-right">
        <button
          onClick={() => onRemove(file.id)}
          className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
          title="删除文件 / Remove file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

export const FileTable: React.FC<FileTableProps> = ({
  files,
  rule,
  onRemove,
  onDateChange,
  onReorder,
  sortOrder,
  onSortChange,
  onNameSourceChange,
}) => {
  const isManualSort = sortOrder === 'manual';

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (files.length === 0) {
    return null;
  }

  const toggleSort = () => {
    if (sortOrder === 'newest') {
      onSortChange('oldest');
      return;
    }

    if (sortOrder === 'oldest') {
      onSortChange('number');
      return;
    }

    if (sortOrder === 'number') {
      onSortChange('name');
      return;
    }

    if (sortOrder === 'name') {
      onSortChange('manual');
      return;
    }

    onSortChange('newest');
  };

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'newest':
        return '最新优先 / Newest First';
      case 'oldest':
        return '最旧优先 / Oldest First';
      case 'name':
        return '名称排序 / Name';
      case 'number':
        return '原编号 / Original Number';
      case 'manual':
        return '手动拖拽 / Manual Drag';
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isManualSort) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    onReorder(String(active.id), String(over.id));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          文件列表 (Files) · {files.length}
        </h3>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          {isManualSort && (
            <span className="text-xs text-slate-500 hidden xl:inline">
              拖拽行以调整编号顺序 (Drag rows to change numbering order)
            </span>
          )}
          <button
            onClick={toggleSort}
            className="flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-md transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>排序 (Sort): {getSortLabel()}</span>
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1 p-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full min-w-[1120px] table-fixed text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 w-16 text-center">
                  <HeaderLabel zh="拖拽" en="Drag" align="center" />
                </th>
                {rule.mode === 'sequential' ? (
                  <th className="px-6 py-3 border-b border-slate-200 w-[18%]">
                    <HeaderLabel zh="发布日期" en="Publication Date" />
                  </th>
                ) : (
                  <th className="px-6 py-3 border-b border-slate-200 w-[18%]">
                    <HeaderLabel zh="原编号" en="Original Number" />
                  </th>
                )}
                <th className="px-6 py-3 border-b border-slate-200 w-[29%]">
                  <HeaderLabel zh="原始文件" en="Original File" />
                </th>
                <th className="px-6 py-3 border-b border-slate-200 w-[39%] text-primary-700">
                  <HeaderLabel zh="生成名称" en="Generated Name" accent />
                </th>
                <th className="px-6 py-3 border-b border-slate-200 w-20 text-right">
                  <HeaderLabel zh="操作" en="Actions" align="right" />
                </th>
              </tr>
            </thead>
            <SortableContext
              items={files.map((file) => file.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="divide-y divide-slate-100">
                {files.map((file, index) => (
                  <SortableRow
                    key={file.id}
                    file={file}
                    index={index}
                    rule={rule}
                    isManualSort={isManualSort}
                    onRemove={onRemove}
                    onDateChange={onDateChange}
                    onNameSourceChange={onNameSourceChange}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center">
        {isManualSort
          ? '提示：手动拖拽后的顺序会直接影响 sequential 模式下的新编号生成。'
          : rule.mode === 'sequential'
            ? '提示：默认使用文件名；每个文件都可以单独切换为正文标题或 metadata 标题。'
            : '提示：Offset 模式会保留原始编号基准，同时继续显示每个文件当前的命名来源。'}
      </div>
    </div>
  );
};
