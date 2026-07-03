'use client';

import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Modal } from '../Modal';
import { CustomSelect } from '../CustomSelect';
import { Profile } from '@/types';

interface AdminCreateUserModalProps {
  showCreateUserModal: boolean;
  setShowCreateUserModal: (val: boolean) => void;
  profile: Profile | null;
  setNewStaffPassword: (val: string) => void;
  newStaffUsername: string;
  setNewStaffUsername: (val: string) => void;
  newStaffRole: string;
  setNewStaffRole: (val: string) => void;
  newStaffNeedsApproval: boolean;
  setNewStaffNeedsApproval: (val: boolean) => void;
  newStaffAllowReserve: boolean;
  setNewStaffAllowReserve: (val: boolean) => void;
  newStaffAllowOvertime: boolean;
  setNewStaffAllowOvertime: (val: boolean) => void;
  creatingUser: boolean;
  setNewStaffConfirmPassword: (val: string) => void;
  handleCreateNewUser: () => void;
  newStaffEligibleOfficeLeave: boolean;
  setNewStaffEligibleOfficeLeave: (val: boolean) => void;
  newStaffEligibleGovtHoliday: boolean;
  setNewStaffEligibleGovtHoliday: (val: boolean) => void;
  profilesList: Profile[];
  newStaffSupervisorIds: string[];
  setNewStaffSupervisorIds: (ids: string[]) => void;
}

export function AdminCreateUserModal({
  showCreateUserModal,
  setShowCreateUserModal,
  profile,
  setNewStaffPassword,
  newStaffUsername,
  setNewStaffUsername,
  newStaffRole,
  setNewStaffRole,
  newStaffNeedsApproval,
  setNewStaffNeedsApproval,
  newStaffAllowReserve,
  setNewStaffAllowReserve,
  newStaffAllowOvertime,
  setNewStaffAllowOvertime,
  creatingUser,
  setNewStaffConfirmPassword,
  handleCreateNewUser,
  newStaffEligibleOfficeLeave,
  setNewStaffEligibleOfficeLeave,
  newStaffEligibleGovtHoliday,
  setNewStaffEligibleGovtHoliday,
  profilesList,
  newStaffSupervisorIds,
  setNewStaffSupervisorIds,
}: AdminCreateUserModalProps) {
  const roleOptions = [
    { value: 'user', label: 'Staff / User' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'admin', label: 'Admin' },
  ];
  const supervisors = (profilesList || []).filter(p => p.role === 'supervisor');
  const handleClose = () => {
    setShowCreateUserModal(false);
    setNewStaffPassword('123456');
    setNewStaffConfirmPassword('123456');
    setNewStaffUsername('');
    setNewStaffRole('user');
    setNewStaffNeedsApproval(false);
    setNewStaffAllowReserve(false);
    setNewStaffSupervisorIds([]);
  };

  return (
    <Modal
      isOpen={showCreateUserModal && profile?.role === 'admin'}
      onClose={handleClose}
      title="Add New Staff"
      icon={<Plus className="h-5 w-5 text-blue-500" />}
      glowClass="bg-blue-900/10"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Codename (Username)</label>
          <input
            type="text"
            placeholder="e.g., KI1024"
            value={newStaffUsername}
            onChange={(e) => setNewStaffUsername(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
          />
        </div>


        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Role</label>
          <CustomSelect
            value={newStaffRole}
            onChange={setNewStaffRole}
            options={roleOptions}
            className="w-full mt-1"
          />
        </div>

        {/* Checkboxes Grid */}
        <div className="grid grid-cols-1 gap-2.5 pt-2">
          <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={newStaffNeedsApproval}
              onChange={(e) => setNewStaffNeedsApproval(e.target.checked)}
              className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
            />
            <div>
              <span className="block text-xs font-semibold text-white">Supervisor Approval?</span>
              <span className="block text-[10px] text-slate-400">If checked, leaves will require supervisor approval</span>
            </div>
          </label>

          {newStaffNeedsApproval && supervisors.length > 0 && (
            <div className="space-y-2 bg-slate-955/40 p-3 rounded-lg border border-slate-800/80 -mt-1 ml-2">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Select Supervisors
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {newStaffSupervisorIds.length > 0 ? `${newStaffSupervisorIds.length} Selected` : 'All Selected'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <label className={`flex items-center gap-2 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[11px] ${
                  newStaffSupervisorIds.length === 0 
                    ? 'border-blue-600 bg-blue-955/20 text-blue-400' 
                    : 'border-slate-850 bg-slate-900/60 text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={newStaffSupervisorIds.length === 0}
                    onChange={() => setNewStaffSupervisorIds([])}
                    className="rounded-full border-slate-700 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="font-semibold">All</span>
                </label>
                
                {supervisors.map(sup => {
                  const isChecked = newStaffSupervisorIds.includes(sup.id);
                  return (
                    <label 
                      key={sup.id} 
                      className={`flex items-center gap-2 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[11px] ${
                        isChecked 
                          ? 'border-blue-600 bg-blue-955/20 text-blue-400' 
                          : 'border-slate-850 bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setNewStaffSupervisorIds(newStaffSupervisorIds.filter(id => id !== sup.id));
                          } else {
                            setNewStaffSupervisorIds([...newStaffSupervisorIds, sup.id]);
                          }
                        }}
                        className="rounded-full border-slate-700 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="font-semibold">
                        {sup.username} {sup.full_name ? `(${sup.full_name})` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={newStaffEligibleOfficeLeave}
              onChange={(e) => setNewStaffEligibleOfficeLeave(e.target.checked)}
              className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-950 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
            />
            <div>
              <span className="block text-xs font-semibold text-white">Office Leave Eligible?</span>
              <span className="block text-[10px] text-slate-400">If enabled, eligible for annual office leaves and Eid holidays</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={newStaffEligibleGovtHoliday}
              onChange={(e) => setNewStaffEligibleGovtHoliday(e.target.checked)}
              className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
            />
            <div>
              <span className="block text-xs font-semibold text-white">Govt Holiday Eligible?</span>
              <span className="block text-[10px] text-slate-400">If enabled, eligible for leaves according to the government holiday list</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={newStaffAllowReserve}
              onChange={(e) => setNewStaffAllowReserve(e.target.checked)}
              className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
            />
            <div>
              <span className="block text-xs font-semibold text-white">Reserve Govt Holiday?</span>
              <span className="block text-[10px] text-slate-400">If checked, will have option to reserve government holidays</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={newStaffAllowOvertime}
              onChange={(e) => setNewStaffAllowOvertime(e.target.checked)}
              className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
            />
            <div>
              <span className="block text-xs font-semibold text-white">Overtime Category?</span>
              <span className="block text-[10px] text-slate-400">If checked, overtime leave category will be enabled</span>
            </div>
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateNewUser}
            disabled={creatingUser || !newStaffUsername}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {creatingUser && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {creatingUser ? 'Creating...' : 'Create Staff'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
