
import React, { memo } from 'react';
import { FileText, Save, Shield, Trash2, Plus } from 'lucide-react';
import { SanitizerRule } from '@/utils/fileNameSanitizer';

interface SanitizerTabProps {
  sanitizerRules: SanitizerRule[];
  sanitizerInput: string;
  setSanitizerInput: (val: string) => void;
  handleAddSanitizerWord: () => void;
  handleToggleSanitizerWord: (word: string, currentStatus: boolean) => void;
  handleRemoveSanitizerWord: (word: string) => void;
  handleSaveSanitizerRules: (nextRules?: any) => void;
  sanitizerSubmitting: boolean;
  hasChanges: boolean;
}

export const SanitizerTab = memo(function SanitizerTab({
  sanitizerRules,
  sanitizerInput,
  setSanitizerInput,
  handleAddSanitizerWord,
  handleToggleSanitizerWord,
  handleRemoveSanitizerWord,
  handleSaveSanitizerRules,
  sanitizerSubmitting,
  hasChanges
}: SanitizerTabProps) {
  return (
        <div className="space-y-6 w-full font-sans">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-theme-border-input/40">
              <Shield className="h-5 w-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider">
                  Filename Sanitization Rules
                </h3>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  Manage words that should be automatically removed when cleaning filenames.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={sanitizerInput}
                onChange={(e) => setSanitizerInput(e.target.value)}
                placeholder="Enter a word to remove (e.g. V1, final, draft)"
                className="flex-1 bg-theme-page-bg/80 border border-theme-border-input rounded-xl px-3 py-2 text-sm text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:border-indigo-500 font-sans"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSanitizerWord();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSanitizerWord}
                disabled={sanitizerSubmitting || !sanitizerInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 font-sans"
              >
                <Plus className="h-4 w-4" /> Add Word
              </button>
            </div>

            <div className="bg-theme-page-bg/40 border border-theme-border-input/60 rounded-xl p-4 max-h-[400px] overflow-y-auto">
              {sanitizerRules.length === 0 ? (
                <div className="text-center py-6 text-theme-text-muted text-sm font-sans flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 opacity-20" />
                  <p>No sanitization rules defined yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sanitizerRules.map((rule, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        rule.enabled 
                          ? 'bg-theme-card-bg border-indigo-500/30 shadow-sm' 
                          : 'bg-theme-page-bg/40 border-theme-border-input/40 opacity-60 grayscale'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSanitizerWord(rule.word, rule.enabled)}
                        className="flex-1 text-left px-2 flex items-center gap-2"
                        title={rule.enabled ? "Click to disable" : "Click to enable"}
                      >
                        <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        <span className={`text-sm font-medium font-sans truncate ${
                          rule.enabled ? 'text-theme-text-primary' : 'text-theme-text-muted line-through'
                        }`}>
                          {rule.word}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={sanitizerSubmitting}
                        onClick={() => handleRemoveSanitizerWord(rule.word)}
                        className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-955/30 transition-all cursor-pointer shrink-0"
                        title="Delete Rule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-theme-border-input/40 flex justify-end">
              <button
                type="button"
                disabled={!hasChanges || sanitizerSubmitting}
                onClick={handleSaveSanitizerRules}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 font-sans shadow-md"
              >
                {sanitizerSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
  );
});
