
import React, { memo } from 'react';
import { Globe, Trash2 } from 'lucide-react';

interface VpnListTabProps {
  vpnList: string[];
  newVpnInput: string;
  setNewVpnInput: (val: string) => void;
  handleAddVpnName: () => void;
  handleRemoveVpnName: (name: string) => void;
  vpnSubmitting: boolean;
}

export const VpnListTab = memo(function VpnListTab({
  vpnList,
  newVpnInput,
  setNewVpnInput,
  handleAddVpnName,
  handleRemoveVpnName,
  vpnSubmitting
}: VpnListTabProps) {
  return (
        <div className="space-y-6 w-full font-sans">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-theme-border-input/40">
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 shrink-0">
                <Globe className="h-4 w-4 text-blue-400" />
                VPN List Management
              </h3>

              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={newVpnInput}
                  onChange={(e) => setNewVpnInput(e.target.value)}
                  placeholder="e.g. ExpressVPN, NordVPN, Surfshark"
                  className="flex-1 bg-theme-page-bg/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:border-blue-500 font-sans"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVpnName();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={vpnSubmitting || !newVpnInput.trim()}
                  onClick={handleAddVpnName}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sans shrink-0"
                >
                  Add VPN
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {vpnList.map((vpnName, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-theme-page-bg/40 border border-theme-border-input/60">
                  <span className="text-xs font-medium text-theme-text-primary font-sans">{vpnName}</span>
                  <button
                    type="button"
                    disabled={vpnSubmitting}
                    onClick={() => handleRemoveVpnName(vpnName)}
                    className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-955/30 transition-all cursor-pointer"
                    title="Remove VPN"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
  );
});
