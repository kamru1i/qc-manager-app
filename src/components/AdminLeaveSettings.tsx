'use client';

import React, { useState } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { GlobalSettings } from '@/utils/dashboardHelpers';
import { StatCard } from './StatCard';
import { AdminOfficeLeaveSettingsModal } from './modals/AdminOfficeLeaveSettingsModal';
import { AdminEidLeaveSettingsModal } from './modals/AdminEidLeaveSettingsModal';
import { AdminGovtHolidaysSettingsModal } from './modals/AdminGovtHolidaysSettingsModal';

interface AdminLeaveSettingsProps {
  globalSettings: GlobalSettings;
  onSaveGlobalSettings: (settings: GlobalSettings, options?: { silent?: boolean }) => Promise<boolean>;
  initialFetchDone: boolean;
}

export function AdminLeaveSettings({
  globalSettings,
  onSaveGlobalSettings,
  initialFetchDone,
}: AdminLeaveSettingsProps) {
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [showEidModal, setShowEidModal] = useState(false);
  const [showGovtModal, setShowGovtModal] = useState(false);

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl shadow-2xl rounded-2xl p-6 flex flex-col gap-6 animate-fade-in border border-slate-850">
      <div>
        <h3 className="text-md font-bold text-white flex items-center gap-2">
          <Settings className="h-4.5 w-4.5 text-blue-400" />
          Leave Settings Panel
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Configure global office leave quotas, Eid leaves, and government holidays for the current year.
        </p>
      </div>

      <div className="flex flex-wrap justify-center sm:justify-start gap-6 w-full mt-2">
        {/* Card 1: Office Allocated Leave */}
        <StatCard
          icon={Calendar}
          iconBgClass="bg-blue-500/10"
          iconColorClass="text-blue-400"
          iconBorderClass="border-blue-500/20"
          title="Allocated Office Leave"
          value={`${globalSettings.office_leave_h1 + globalSettings.office_leave_h2} days`}
          action={
            <button
              onClick={() => setShowOfficeModal(true)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
              title="Leave Quota Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          }
          className="w-full max-w-xs"
          loading={!initialFetchDone}
        />

        {/* Card 2: Eid Leave */}
        <StatCard
          icon={Calendar}
          iconBgClass="bg-blue-500/10"
          iconColorClass="text-blue-400"
          iconBorderClass="border-blue-500/20"
          title="Eid Leave"
          value={`${(globalSettings.eid_fitr_leave ?? 0) + (globalSettings.eid_adha_leave ?? 0)} days`}
          action={
            <button
              onClick={() => setShowEidModal(true)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
              title="Eid Leave Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          }
          className="w-full max-w-xs"
          loading={!initialFetchDone}
        />

        {/* Card 3: Govt Holiday */}
        <StatCard
          icon={Calendar}
          iconBgClass="bg-teal-500/10"
          iconColorClass="text-teal-400"
          iconBorderClass="border-teal-500/20"
          title="Govt Holiday"
          value={`${globalSettings.govt_holidays?.length ?? 0} days`}
          action={
            <button
              onClick={() => setShowGovtModal(true)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
              title="Govt Holiday Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          }
          className="w-full max-w-xs"
          loading={!initialFetchDone}
        />
      </div>

      {/* Admin Settings Modals */}
      <AdminOfficeLeaveSettingsModal
        showModal={showOfficeModal}
        setShowModal={setShowOfficeModal}
        globalSettings={globalSettings}
        onSave={onSaveGlobalSettings}
      />
      <AdminEidLeaveSettingsModal
        showModal={showEidModal}
        setShowModal={setShowEidModal}
        globalSettings={globalSettings}
        onSave={onSaveGlobalSettings}
      />
      <AdminGovtHolidaysSettingsModal
        showModal={showGovtModal}
        setShowModal={setShowGovtModal}
        globalSettings={globalSettings}
        onSave={onSaveGlobalSettings}
      />
    </div>
  );
}
