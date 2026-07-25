import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, X, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';
import { SystemPreferences } from './SystemPreferences';
import { DeviceProvisioning } from './DeviceProvisioning';
import { CompanyIdCard } from './CompanyIdCard';

export function SettingsPage() {
  const { setTheme } = useTheme();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Account settings state
  const [accountData, setAccountData] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    company: ''
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const docRef = doc(db, "users", auth.currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setAccountData({
              name: data.fullName || auth.currentUser.displayName || '',
              email: data.email || auth.currentUser.email || '',
              role: data.role || 'User',
              phone: data.phone || '',
              company: data.companyName || ''
            });
            // Load other settings if they exist in the doc
            if (data.settings) {
              if (data.settings.notifications) setNotificationSettings(data.settings.notifications);
              if (data.settings.security) setSecuritySettings(data.settings.security);
              if (data.settings.preferences) {
                setSystemPreferences(data.settings.preferences);
                if (data.settings.preferences.theme) {
                  setTheme(data.settings.preferences.theme as 'dark' | 'light');
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    alertNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    criticalAlertsOnly: false
  });

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    loginAlerts: true
  });

  // System preferences state
  const [systemPreferences, setSystemPreferences] = useState({
    language: 'en',
    timezone: 'Asia/Karachi',
    theme: 'dark',
    dateFormat: 'DD/MM/YYYY',
    temperatureUnit: 'celsius'
  });

  const handleSave = async () => {
    if (!auth.currentUser) return;

    setIsSaving(true);
    try {
      // 1. Update Auth Profile (DisplayName)
      if (auth.currentUser.displayName !== accountData.name) {
        await updateProfile(auth.currentUser, {
          displayName: accountData.name
        });
      }

      // 2. Update Firestore User Document
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userRef, {
        fullName: accountData.name,
        email: accountData.email,
        phone: accountData.phone,
        companyName: accountData.company,
        role: accountData.role,
        updatedAt: new Date().toISOString(),
        settings: {
          notifications: notificationSettings,
          security: securitySettings,
          preferences: systemPreferences
        }
      }, { merge: true });

      setIsSaving(false);
      setHasChanges(false);
      // Optional: Add a toast notification here
      console.log('Settings successfully saved to Firebase');
    } catch (error) {
      console.error("Error saving settings:", error);
      setIsSaving(false);
      // Optional: error handling feedback
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setHasChanges(false);
    // You would reload the original data here
  };

  const handleChange = () => {
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07121A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-[#009FFD]/20 rounded-lg border border-[#00E5FF]/30">
            <SettingsIcon className="w-6 h-6 text-[#00E5FF]" />
          </div>
          <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text">Settings</h1>
        </div>
        <p className="text-[#D9DCE1]/70 ml-[60px]">
          Manage your account, notifications, security, and system preferences
        </p>
      </div>

      {/* Settings Content */}
      <div className="max-w-5xl space-y-6">
        {/* Company ID — for contract sharing */}
        <CompanyIdCard />

        {/* Account Settings */}
        <AccountSettings
          data={accountData}
          onChange={(newData) => {
            setAccountData(newData);
            handleChange();
          }}
        />

        {/* Notification Settings */}
        <NotificationSettings
          settings={notificationSettings}
          onChange={(newSettings) => {
            setNotificationSettings(newSettings);
            handleChange();
          }}
        />

        {/* Security Settings */}
        <SecuritySettings
          settings={securitySettings}
          onChange={(newSettings) => {
            setSecuritySettings(newSettings);
            handleChange();
          }}
        />

        {/* System Preferences */}
        <SystemPreferences
          preferences={systemPreferences}
          onChange={(newPreferences) => {
            setSystemPreferences(newPreferences);
            if (newPreferences.theme !== systemPreferences.theme) {
              setTheme(newPreferences.theme as 'dark' | 'light');
            }
            handleChange();
          }}
        />

        {/* Device Provisioning — admin only */}
        {accountData.role?.toLowerCase() === 'admin' && <DeviceProvisioning />}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 pb-4">
          <button
            onClick={handleCancel}
            disabled={!hasChanges}
            className="px-6 py-3 bg-[#07121A] border border-[#00E5FF]/20 hover:bg-[#00E5FF]/10 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <X className="w-5 h-5" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-6 py-3 bg-gradient-to-r from-[#00FFFF] to-[#009FFD] hover:from-[#00E5FF] hover:to-[#007FFF] text-[#07121A] rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#FFB02E]/20 border border-[#FFB02E]/40 rounded-lg px-6 py-3 neon-glow animate-fade-in">
          <p className="text-[#FFB02E] text-sm">
            You have unsaved changes. Don't forget to save before leaving!
          </p>
        </div>
      )}
    </div>
  );
}