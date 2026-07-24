import { Bell, Mail, MessageSquare, Smartphone, AlertCircle } from 'lucide-react';

interface NotificationSettingsProps {
  settings: {
    alertNotifications: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    criticalAlertsOnly: boolean;
  };
  onChange: (settings: any) => void;
}

export function NotificationSettings({ settings, onChange }: NotificationSettingsProps) {
  const handleToggle = (key: string) => {
    onChange({ ...settings, [key]: !settings[key as keyof typeof settings] });
  };

  const notifications = [
    {
      key: 'alertNotifications',
      icon: Bell,
      title: 'Alert Notifications',
      description: 'Receive notifications for all fleet alerts and warnings',
      enabled: settings.alertNotifications
    },
    {
      key: 'emailNotifications',
      icon: Mail,
      title: 'Email Notifications',
      description: 'Get email updates about important events and reports',
      enabled: settings.emailNotifications
    },
    {
      key: 'smsNotifications',
      icon: MessageSquare,
      title: 'SMS Notifications',
      description: 'Receive critical alerts via SMS to your mobile phone',
      enabled: settings.smsNotifications
    },
    {
      key: 'pushNotifications',
      icon: Smartphone,
      title: 'Push Notifications',
      description: 'Get instant push notifications on your devices',
      enabled: settings.pushNotifications
    },
    {
      key: 'criticalAlertsOnly',
      icon: AlertCircle,
      title: 'Critical Alerts Only',
      description: 'Only receive notifications for critical and high-priority alerts',
      enabled: settings.criticalAlertsOnly
    }
  ];

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 neon-glow">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#00E5FF]/20">
        <div className="p-2 bg-[#009FFD]/20 rounded-lg">
          <Bell className="w-5 h-5 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-xl text-white">Notification Settings</h2>
          <p className="text-sm text-[#D9DCE1]/60">Control how you receive alerts and updates</p>
        </div>
      </div>

      {/* Notification Toggles */}
      <div className="space-y-4">
        {notifications.map((notification) => {
          const Icon = notification.icon;
          return (
            <div
              key={notification.key}
              className="flex items-center justify-between p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
                  <Icon className="w-5 h-5 text-[#00E5FF]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white mb-1">{notification.title}</h3>
                  <p className="text-sm text-[#D9DCE1]/60">{notification.description}</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle(notification.key)}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  notification.enabled
                    ? 'bg-[#009FFD]'
                    : 'bg-[#07121A] border border-[#00E5FF]/20'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
                    notification.enabled
                      ? 'translate-x-7 bg-white shadow-[0_0_10px_rgba(0,229,255,0.5)]'
                      : 'translate-x-0 bg-[#D9DCE1]/30'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg">
        <p className="text-sm text-[#D9DCE1]/70">
          <strong className="text-[#00E5FF]">Note:</strong> Critical security alerts will always be sent regardless of your notification preferences.
        </p>
      </div>
    </div>
  );
}
