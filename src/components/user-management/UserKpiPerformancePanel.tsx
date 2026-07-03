'use client';

import React from 'react';
import { Profile } from '@/types';
import { BarChart2 } from 'lucide-react';

interface UserKpiPerformancePanelProps {
  viewingStaff: Profile;
}

export const UserKpiPerformancePanel: React.FC<UserKpiPerformancePanelProps> = ({ viewingStaff }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-slate-900/20 border border-slate-850/60 rounded-2xl text-center p-8">
      <div className="p-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl mb-4">
        <BarChart2 className="h-8 w-8 text-blue-500" />
      </div>
      <h4 className="text-md font-bold text-white mb-2">KPI & Staff Performance Metrics</h4>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
        This section is currently under development. Soon, it will display monthly quotation volumes, conversion success rates, and performance benchmarks for <strong>{viewingStaff?.full_name}</strong>.
      </p>
    </div>
  );
};
