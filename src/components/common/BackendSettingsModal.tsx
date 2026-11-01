import React, { useState } from 'react';
import { MedhaApiService } from '../../services/api';
import { AppConfig } from '../../types';
import { X, Check, Database, ExternalLink, RefreshCw, AlertCircle, Save } from 'lucide-react';

interface BackendSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const BackendSettingsModal: React.FC<BackendSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const [config, setConfig] = useState<AppConfig>(() => MedhaApiService.getConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    MedhaApiService.saveConfig(config);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onSaved();
      onClose();
    }, 600);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await MedhaApiService.syncFromGoogleSheets();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Check Google Sheets sharing permissions.'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white text-[#1e1b4b] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#ece9f4] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#ece9f4] flex items-center justify-between bg-[#fafafa]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ede9fe] text-[#5b21b6] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1e1b4b]">Google Sheets & Backend Configuration</h3>
              <p className="text-xs text-[#64748b]">Manage the three Google spreadsheets and Google Apps Script link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-[#1e1b4b] hover:bg-[#ece9f4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
          {/* Apps Script Web App URL */}
          <div>
            <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-1">
              Google Apps Script Web App URL
            </label>
            <input
              type="url"
              value={config.backendUrl}
              onChange={(e) => setConfig({ ...config, backendUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent bg-[#fafafa]"
            />
            <p className="text-[11px] text-[#64748b] mt-1">
              Optional for read access (live gviz queries the spreadsheets directly). Required for writing changes and sending mass emails.
            </p>
          </div>

          <div className="border-t border-[#ece9f4] pt-3">
            <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Linked Spreadsheets</h4>

            {/* Medha Program Sheet */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-[#1e1b4b] mb-1">
                1. Medha Program Spreadsheet ID (NCM-P1, NCM-P2 Members)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.sheetIdMedha}
                  onChange={(e) => setConfig({ ...config, sheetIdMedha: e.target.value })}
                  className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                />
                <a
                  href={`https://docs.google.com/spreadsheets/d/${config.sheetIdMedha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-xs font-medium text-[#5b21b6] hover:bg-[#ede9fe] rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
              </div>
            </div>

            {/* NCM Part 1 Tracker */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-[#1e1b4b] mb-1">
                2. NCM Part 1 Current Tracker Spreadsheet ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.sheetIdNcm}
                  onChange={(e) => setConfig({ ...config, sheetIdNcm: e.target.value })}
                  className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                />
                <a
                  href={`https://docs.google.com/spreadsheets/d/${config.sheetIdNcm}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-xs font-medium text-[#5b21b6] hover:bg-[#ede9fe] rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
              </div>
            </div>

            {/* Batch-01 Master */}
            <div>
              <label className="block text-xs font-semibold text-[#1e1b4b] mb-1">
                3. Medha Batch-01 Master Spreadsheet ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.sheetIdBatch01}
                  onChange={(e) => setConfig({ ...config, sheetIdBatch01: e.target.value })}
                  className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                />
                <a
                  href={`https://docs.google.com/spreadsheets/d/${config.sheetIdBatch01}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-xs font-medium text-[#5b21b6] hover:bg-[#ede9fe] rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
              </div>
            </div>
          </div>

          {/* Test connection response */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{testResult.success ? 'Connected' : 'Connection Warning'}</p>
                <p className="text-[11px] mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Footer Actions inside form */}
          <div className="border-t border-[#ece9f4] pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 text-xs font-semibold text-[#5b21b6] bg-[#ede9fe] hover:bg-[#ddd6fe] rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f7f6fb] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] hover:bg-[#6d28d9] rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{savedNotice ? 'Saved!' : 'Save Config'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
