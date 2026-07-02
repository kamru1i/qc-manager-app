'use client';

import React from 'react';
import { CheckCircle, Lock, AlertTriangle, User, RefreshCw } from 'lucide-react';
import { Profile } from '@/types';
import { PasswordMatchIndicator } from '@/components/PasswordMatchIndicator';
import { ProfileFields } from '../ProfileFields';
import { Modal } from '../Modal';

interface WelcomeModalsProps {
  // Onboarding welcome popup
  showWelcomePopup: boolean;
  setShowWelcomePopup: (show: boolean) => void;
  welcomePopupType?: 'onboarding' | 'password_reset';

  // Onboarding details modal
  showOnboardingModal: boolean;

  // First time password & setup modal
  showFirstTimePasswordModal: boolean;
  firstTimePasswordError: string | null;
  firstTimePassword: string;
  setFirstTimePassword: (val: string) => void;
  firstTimeConfirmPassword: string;
  setFirstTimeConfirmPassword: (val: string) => void;
  profile: Profile | null;

  firstTimePasswordSubmitting: boolean;
  sessionUser: any;
  handleFirstTimeSetupSubmit: (e: React.FormEvent) => void;
  handleLogout: () => void;

  // Setup profile for user (not admin) if setup not completed
  setupError: string | null;
  setupFullName: string;
  setSetupFullName: (val: string) => void;
  setupUsername: string;
  setupJobRole: string;
  setSetupJobRole: (val: string) => void;
  setupWorkingHours: string;
  setSetupWorkingHours: (val: string) => void;
  setupBreakTime: string;
  setSetupBreakTime: (val: string) => void;
  setupSignInTime: string;
  setSetupSignInTime: (val: string) => void;
  setupSignOutTime: string;
  setSetupSignOutTime: (val: string) => void;
  setupSubmitting: boolean;
  handleSetupSubmit: (e: React.FormEvent) => void;
}

export const WelcomeModals: React.FC<WelcomeModalsProps> = ({
  showWelcomePopup,
  setShowWelcomePopup,
  welcomePopupType = 'onboarding',

  showOnboardingModal,

  showFirstTimePasswordModal,
  firstTimePasswordError,
  firstTimePassword,
  setFirstTimePassword,
  firstTimeConfirmPassword,
  setFirstTimeConfirmPassword,
  profile: _profile,

  firstTimePasswordSubmitting,
  sessionUser,
  handleFirstTimeSetupSubmit,
  handleLogout,

  setupError,
  setupFullName,
  setSetupFullName,
  setupUsername,
  setupJobRole,
  setSetupJobRole,
  setupWorkingHours,
  setSetupWorkingHours,
  setupBreakTime,
  setSetupBreakTime,
  setupSignInTime,
  setSetupSignInTime,
  setupSignOutTime,
  setSetupSignOutTime,
  setupSubmitting,
  handleSetupSubmit,
}) => {
  const handleCloseWelcome = () => setShowWelcomePopup(false);

  const handleCloseFirstTimePassword = async () => {
    if (sessionUser) {
      localStorage.removeItem(`first_time_modal_start_time_${sessionUser.id}`);
    }
    await handleLogout();
  };

  const showFirstLoginOnboarding = showOnboardingModal;

  return (
    <>
      {/* Welcome & Profile Update Onboarding Popup */}
      <Modal
        isOpen={showWelcomePopup}
        onClose={handleCloseWelcome}
        title={welcomePopupType === 'password_reset' ? 'Password Updated! 🔒' : 'Welcome to your Profile! 🎉'}
        icon={welcomePopupType === 'password_reset' ? <Lock className="h-5 w-5 text-emerald-500" /> : <CheckCircle className="h-5 w-5 text-emerald-500" />}
        maxWidthClass="max-w-sm"
        glowClass="bg-emerald-900/10"
      >
        <div className="text-center font-sans">
          <div className="inline-flex p-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-2xl mb-4">
            {welcomePopupType === 'password_reset' ? (
              <Lock className="h-8 w-8 text-emerald-500" />
            ) : (
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            )}
          </div>

          <p className="text-xs text-slate-355 leading-relaxed mb-4">
            {welcomePopupType === 'password_reset'
              ? 'Your password has been successfully updated and secured!'
              : 'Your password change and profile setup have been successfully completed!'}
          </p>
          <div className="p-3.5 bg-slate-955/60 rounded-xl border border-slate-800/80 text-left text-xs text-slate-400 leading-relaxed space-y-2">
            {welcomePopupType === 'password_reset' ? (
              <>
                <p className="font-semibold text-orange-400 font-sans">🔒 Security Confirmation:</p>
                <p>Your login credentials have been successfully updated. Use your new password to sign in next time.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-orange-400 font-sans">💡 How to update details:</p>
                <p>If needed in the future, you can update your profile info again by clicking on <span className="font-bold text-white">Profile Settings</span> (user/gear icon) located at the top-left of the dashboard.</p>
              </>
            )}
          </div>

          <button
            onClick={handleCloseWelcome}
            className="mt-5 w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all border border-emerald-700 shadow-md"
          >
            Got it
          </button>
        </div>
      </Modal>

      {/* First-Time Password Change & Setup Modal */}
      <Modal
        isOpen={showFirstTimePasswordModal}
        onClose={handleCloseFirstTimePassword}
        title="Change Security Password"
        icon={<Lock className="h-5 w-5 text-orange-500" />}
        maxWidthClass="max-w-md"
        glowClass="bg-orange-900/10"
      >
        <div className="font-sans">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-orange-600/10 border border-orange-500/20 text-orange-400 rounded-2xl mb-3">
              <Lock className="h-6 w-6 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Changing the security password is required after first login</p>
          </div>

          {firstTimePasswordError && (
            <div className="p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{firstTimePasswordError}</span>
            </div>
          )}

          <form onSubmit={handleFirstTimeSetupSubmit} className="space-y-4">
            <div className="p-3 bg-slate-955/60 border border-slate-850 rounded-xl space-y-4">
              <div className="text-xs font-semibold text-orange-400 border-b border-slate-850 pb-1.5 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Change Password
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-455 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={firstTimePassword}
                  onChange={(e) => setFirstTimePassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-455 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter password again"
                  value={firstTimeConfirmPassword}
                  onChange={(e) => setFirstTimeConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <PasswordMatchIndicator password={firstTimePassword} confirmPassword={firstTimeConfirmPassword} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleCloseFirstTimePassword}
                className="flex-1 flex justify-center py-2.5 px-4 border border-slate-800 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-350 bg-slate-950 hover:bg-slate-900 cursor-pointer transition-all"
              >
                Logout
              </button>
              <button
                type="submit"
                disabled={firstTimePasswordSubmitting || firstTimePassword !== firstTimeConfirmPassword || firstTimePassword.length < 4}
                className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {firstTimePasswordSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {firstTimePasswordSubmitting ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* First Login Onboarding Modal */}
      <Modal
        isOpen={!!showFirstLoginOnboarding}
        onClose={handleLogout}
        title="Complete Profile Setup"
        icon={<User className="h-5 w-5 text-orange-500" />}
        maxWidthClass="max-w-md"
        glowClass="bg-orange-900/10"
      >
        <div className="font-sans">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-orange-600/10 border border-orange-500/20 text-orange-400 rounded-2xl mb-3">
              <User className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Please set your correct name and details before accessing the dashboard for the first time</p>
          </div>

          {setupError && (
            <div className="p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{setupError}</span>
            </div>
          )}

          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Codename</label>
              <input
                type="text"
                required
                disabled
                value={(setupUsername || '').toUpperCase()}
                className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-850 rounded-lg text-slate-500 text-sm cursor-not-allowed opacity-60 font-mono"
              />
            </div>

            <ProfileFields
              fullName={setupFullName}
              setFullName={setSetupFullName}
              jobRole={setupJobRole}
              setJobRole={setSetupJobRole}
              workingHours={setupWorkingHours}
              setWorkingHours={setSetupWorkingHours}
              breakTime={setupBreakTime}
              setBreakTime={setSetupBreakTime}
              signInTime={setupSignInTime}
              setSignInTime={setSetupSignInTime}
              signOutTime={setupSignOutTime}
              setSignOutTime={setSetupSignOutTime}
            />

            <button
              type="submit"
              disabled={setupSubmitting}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer disabled:opacity-50 transition-all mt-6 flex items-center justify-center gap-1.5"
            >
              {setupSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {setupSubmitting ? 'Completing setup...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
};
