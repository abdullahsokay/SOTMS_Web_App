import { useState } from 'react';
import { Shield, Lock, Key, Clock, Bell, Smartphone } from 'lucide-react';

interface SecuritySettingsProps {
  settings: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    loginAlerts: boolean;
  };
  onChange: (settings: any) => void;
}

export function SecuritySettings({ settings, onChange }: SecuritySettingsProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleToggle = (key: string) => {
    onChange({ ...settings, [key]: !settings[key as keyof typeof settings] });
  };

  const handleSessionTimeoutChange = (timeout: number) => {
    onChange({ ...settings, sessionTimeout: timeout });
  };

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 neon-glow">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#00E5FF]/20">
        <div className="p-2 bg-[#009FFD]/20 rounded-lg">
          <Shield className="w-5 h-5 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-xl text-white">Security Settings</h2>
          <p className="text-sm text-[#D9DCE1]/60">Protect your account and data</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Change Password */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
                <Lock className="w-5 h-5 text-[#00E5FF]" />
              </div>
              <div>
                <h3 className="text-white mb-1">Password</h3>
                <p className="text-sm text-[#D9DCE1]/60">Change your account password</p>
                <p className="text-xs text-[#D9DCE1]/40 mt-1">Last changed: 30 days ago</p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-[#009FFD]/20 border border-[#00E5FF]/30 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              Change Password
            </button>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
                <Smartphone className="w-5 h-5 text-[#00E5FF]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-1">Two-Factor Authentication</h3>
                <p className="text-sm text-[#D9DCE1]/60">
                  Add an extra layer of security to your account
                </p>
                {settings.twoFactorEnabled && (
                  <p className="text-xs text-[#28B463] mt-1">✓ Enabled via SMS</p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleToggle('twoFactorEnabled')}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                settings.twoFactorEnabled
                  ? 'bg-[#009FFD]'
                  : 'bg-[#07121A] border border-[#00E5FF]/20'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
                  settings.twoFactorEnabled
                    ? 'translate-x-7 bg-white shadow-[0_0_10px_rgba(0,229,255,0.5)]'
                    : 'translate-x-0 bg-[#D9DCE1]/30'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Session Timeout */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
              <Clock className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div className="flex-1">
              <h3 className="text-white mb-1">Session Timeout</h3>
              <p className="text-sm text-[#D9DCE1]/60 mb-3">
                Automatically log out after period of inactivity
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={settings.sessionTimeout}
                  onChange={(e) => handleSessionTimeoutChange(Number(e.target.value))}
                  className="bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-lg px-4 py-2 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all cursor-pointer"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={0}>Never</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Login Alerts */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
                <Bell className="w-5 h-5 text-[#00E5FF]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-1">Login Alerts</h3>
                <p className="text-sm text-[#D9DCE1]/60">
                  Get notified when your account is accessed from a new device
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('loginAlerts')}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                settings.loginAlerts
                  ? 'bg-[#009FFD]'
                  : 'bg-[#07121A] border border-[#00E5FF]/20'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
                  settings.loginAlerts
                    ? 'translate-x-7 bg-white shadow-[0_0_10px_rgba(0,229,255,0.5)]'
                    : 'translate-x-0 bg-[#D9DCE1]/30'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Security Recommendations */}
      <div className="mt-6 p-4 bg-[#28B463]/10 border border-[#28B463]/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#28B463] mt-0.5" />
          <div>
            <h4 className="text-[#28B463] mb-1">Security Recommendations</h4>
            <ul className="text-sm text-[#D9DCE1]/70 space-y-1">
              <li>• Use a strong, unique password for your account</li>
              <li>• Enable two-factor authentication for extra security</li>
              <li>• Review login alerts to detect unauthorized access</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0C1E2C] border border-[#00E5FF]/40 rounded-2xl p-6 max-w-md w-full neon-glow-strong">
            <h3 className="text-xl text-white mb-4">Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#D9DCE1]/70 mb-2 block">Current Password</label>
                <input
                  type="password"
                  className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-[#D9DCE1]/70 mb-2 block">New Password</label>
                <input
                  type="password"
                  className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-[#D9DCE1]/70 mb-2 block">Confirm New Password</label>
                <input
                  type="password"
                  className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 px-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/20 hover:bg-[#00E5FF]/10 text-white rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Password changed');
                  setShowPasswordModal(false);
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#00FFFF] to-[#009FFD] hover:from-[#00E5FF] hover:to-[#007FFF] text-[#07121A] rounded-lg transition-all duration-200 hover:scale-105"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
