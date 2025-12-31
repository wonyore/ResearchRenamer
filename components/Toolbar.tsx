import React from 'react';
import { RenamingRule, NumberFormat } from '../types';
import { Settings, RefreshCw, ArrowUpDown, Calendar } from './IconComponents';

interface ToolbarProps {
  rule: RenamingRule;
  setRule: (rule: RenamingRule) => void;
  fileCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({ rule, setRule, fileCount }) => {
  const handleChange = (key: keyof RenamingRule, value: any) => {
    setRule({ ...rule, [key]: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-fit lg:sticky lg:top-6 space-y-6">
      <div className="flex items-center gap-2 text-slate-800 font-semibold border-b border-slate-100 pb-3">
        <Settings className="w-5 h-5 text-primary-600" />
        <h2>编号规则配置 (Settings)</h2>
      </div>

      {/* Mode Selection Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button
            onClick={() => handleChange('mode', 'sequential')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5
                ${rule.mode === 'sequential' 
                    ? 'bg-white text-primary-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'}
            `}
        >
            <Calendar className="w-3.5 h-3.5" />
            时间排序重排
        </button>
        <button
             onClick={() => handleChange('mode', 'offset')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5
                ${rule.mode === 'offset' 
                    ? 'bg-white text-primary-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'}
            `}
        >
            <ArrowUpDown className="w-3.5 h-3.5" />
            整体平移跳号
        </button>
      </div>

      <div className="space-y-4">
        {/* Conditional Input: Start Number vs Offset */}
        {rule.mode === 'sequential' ? (
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    起始编号 (Start From)
                </label>
                <div className="relative">
                    <input
                        type="number"
                        value={rule.startNumber}
                        onChange={(e) => handleChange('startNumber', parseInt(e.target.value) || 0)}
                        className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                    <div className="absolute right-3 top-2 text-xs text-slate-400 pointer-events-none">
                        e.g., 1
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    按时间排序，重新生成连续编号 (1, 2, 3...)
                </p>
            </div>
        ) : (
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    编号增减量 (Offset Value)
                </label>
                <div className="relative">
                    <input
                        type="number"
                        value={rule.offsetValue}
                        onChange={(e) => handleChange('offsetValue', parseInt(e.target.value) || 0)}
                        className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors font-mono"
                        placeholder="+0"
                    />
                    <div className="absolute right-3 top-2 text-xs text-slate-400 pointer-events-none">
                        e.g., +2, -1
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    保留原有跳号，仅对数字进行加减运算 (1, 3 -> 3, 5)
                </p>
            </div>
        )}

        {/* Format Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            目标编号样式 (Target Format)
          </label>
          <select
            value={rule.formatType}
            onChange={(e) => handleChange('formatType', e.target.value as NumberFormat)}
            className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            <option value={NumberFormat.Brackets}>[01] 方括号</option>
            <option value={NumberFormat.Dot}>01. 点号</option>
            <option value={NumberFormat.Underscore}>01_ 下划线</option>
            <option value={NumberFormat.Hyphen}>01- 连字符</option>
            <option value={NumberFormat.Custom}>自定义 (Custom)</option>
          </select>
        </div>

        {/* Custom Prefix (Conditional) */}
        {rule.formatType === NumberFormat.Custom && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              自定义前缀 (Prefix)
            </label>
            <input
              type="text"
              value={rule.customPrefix}
              onChange={(e) => handleChange('customPrefix', e.target.value)}
              placeholder="e.g. P-"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {/* Separator */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            连接符 (Separator)
          </label>
          <div className="flex gap-2">
            <input
                type="text"
                value={rule.customSuffix}
                onChange={(e) => handleChange('customSuffix', e.target.value)}
                placeholder=" "
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            />
          </div>
        </div>

        {/* Padding */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            最小位数 (Min Digits)
          </label>
          <div className="flex items-center gap-3">
             <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={rule.minDigits}
              onChange={(e) => handleChange('minDigits', parseInt(e.target.value))}
              className="flex-1 accent-primary-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded text-sm">
                {String(1).padStart(rule.minDigits, '0')}
            </span>
          </div>
        </div>
      </div>
        
      {/* Preview Stats */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Preview Status
        </h3>
        <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Mode:</span>
            <span className="font-bold text-primary-700">
                {rule.mode === 'sequential' ? 'Sequential' : 'Offset Shift'}
            </span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
             <span className="text-slate-600">Files:</span>
             <span className="font-bold text-slate-900">{fileCount}</span>
        </div>
      </div>
    </div>
  );
};