import { Globe, Palette, Calendar, Thermometer } from 'lucide-react';

interface SystemPreferencesProps {
  preferences: {
    language: string;
    timezone: string;
    theme: string;
    dateFormat: string;
    temperatureUnit: string;
  };
  onChange: (preferences: any) => void;
}

export function SystemPreferences({ preferences, onChange }: SystemPreferencesProps) {
  const handleChange = (key: string, value: string) => {
    onChange({ ...preferences, [key]: value });
  };

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'ur', label: 'Urdu (اردو)' }
  ];

  // Light mode is not production-ready (see ThemeContext); only Dark is offered
  // so operators aren't shown a broken, unreadable theme.
  const themes = [
    { value: 'dark', label: 'Dark Mode', description: 'Default dark theme' }
  ];

  const dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (30/11/2025)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (11/30/2025)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-11-30)' }
  ];

  const temperatureUnits = [
    { value: 'celsius', label: 'Celsius (°C)' },
    { value: 'fahrenheit', label: 'Fahrenheit (°F)' }
  ];

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 neon-glow">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#00E5FF]/20">
        <div className="p-2 bg-[#009FFD]/20 rounded-lg">
          <Palette className="w-5 h-5 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-xl text-white">System Preferences</h2>
          <p className="text-sm text-[#D9DCE1]/60">Customize your experience</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Language */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
              <Globe className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div className="flex-1">
              <h3 className="text-white mb-1">Language</h3>
              <p className="text-sm text-[#D9DCE1]/60 mb-3">Select your preferred language</p>
              <select
                value={preferences.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="w-full bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all cursor-pointer"
              >
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
              <Palette className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div className="flex-1">
              <h3 className="text-white mb-1">Theme</h3>
              <p className="text-sm text-[#D9DCE1]/60 mb-3">Choose your display theme</p>
              <div className="space-y-2">
                {themes.map((theme) => (
                  <button
                    key={theme.value}
                    onClick={() => handleChange('theme', theme.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 text-left ${preferences.theme === theme.value
                        ? 'bg-[#009FFD]/20 border border-[#00E5FF]/40'
                        : 'bg-[#0C1E2C] border border-[#00E5FF]/10 hover:border-[#00E5FF]/20'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${preferences.theme === theme.value ? 'border-[#00E5FF]' : 'border-[#D9DCE1]/50'
                      }`}>
                      {preferences.theme === theme.value && <div className="w-2 h-2 bg-[#00E5FF] rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-white">{theme.label}</div>
                      <div className="text-xs text-[#D9DCE1]/50">{theme.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Date Format */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
              <Calendar className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div className="flex-1">
              <h3 className="text-white mb-1">Date Format</h3>
              <p className="text-sm text-[#D9DCE1]/60 mb-3">Select how dates are displayed</p>
              <select
                value={preferences.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
                className="w-full bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all cursor-pointer"
              >
                {dateFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Temperature Unit */}
        <div className="p-4 bg-[#07121A] border border-[#00E5FF]/10 rounded-xl hover:border-[#00E5FF]/30 transition-all duration-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-[#009FFD]/10 rounded-lg mt-1">
              <Thermometer className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div className="flex-1">
              <h3 className="text-white mb-1">Temperature Unit</h3>
              <p className="text-sm text-[#D9DCE1]/60 mb-3">Choose temperature measurement unit</p>
              <div className="grid grid-cols-2 gap-2">
                {temperatureUnits.map((unit) => (
                  <button
                    key={unit.value}
                    onClick={() => handleChange('temperatureUnit', unit.value)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-all duration-200 w-full ${preferences.temperatureUnit === unit.value
                      ? 'bg-[#009FFD]/20 border border-[#00E5FF]/40 text-white'
                      : 'bg-[#0C1E2C] border border-[#00E5FF]/10 text-[#D9DCE1]/70 hover:border-[#00E5FF]/20'
                      }`}
                  >
                    <span className="text-sm">{unit.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
