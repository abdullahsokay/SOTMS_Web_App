import { useState } from 'react';
import { User, Mail, Briefcase, Phone, Building, Edit2, Check, X } from 'lucide-react';

interface AccountSettingsProps {
  data: {
    name: string;
    email: string;
    role: string;
    phone: string;
    company: string;
  };
  onChange: (data: any) => void;
}

export function AccountSettings({ data, onChange }: AccountSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(data);

  const handleSave = () => {
    onChange(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(data);
    setIsEditing(false);
  };

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 neon-glow">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#00E5FF]/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#009FFD]/20 rounded-lg">
            <User className="w-5 h-5 text-[#00E5FF]" />
          </div>
          <div>
            <h2 className="text-xl text-white">Account Settings</h2>
            <p className="text-sm text-[#D9DCE1]/60">Manage your personal information</p>
          </div>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-[#009FFD]/20 border border-[#00E5FF]/30 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="p-2 bg-[#FF4D4D]/20 border border-[#FF4D4D]/30 hover:bg-[#FF4D4D]/30 text-[#FF4D4D] rounded-lg transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="p-2 bg-[#28B463]/20 border border-[#28B463]/30 hover:bg-[#28B463]/30 text-[#28B463] rounded-lg transition-all duration-200"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Account Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div>
          <label className="flex items-center gap-2 text-sm text-[#D9DCE1]/70 mb-2">
            <User className="w-4 h-4 text-[#00E5FF]" />
            Full Name
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
            />
          ) : (
            <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-lg px-4 py-2.5 text-white">
              {data.name}
            </div>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="flex items-center gap-2 text-sm text-[#D9DCE1]/70 mb-2">
            <Mail className="w-4 h-4 text-[#00E5FF]" />
            Email Address
          </label>
          {isEditing ? (
            <input
              type="email"
              value={editData.email}
              disabled
              title="Email cannot be changed"
              className="w-full bg-[#07121A]/50 border border-[#00E5FF]/10 rounded-lg px-4 py-2.5 text-white/50 cursor-not-allowed"
            />
          ) : (
            <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-lg px-4 py-2.5 text-white">
              {data.email}
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="flex items-center gap-2 text-sm text-[#D9DCE1]/70 mb-2">
            <Phone className="w-4 h-4 text-[#00E5FF]" />
            Phone Number
          </label>
          {isEditing ? (
            <input
              type="tel"
              value={editData.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
            />
          ) : (
            <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-lg px-4 py-2.5 text-white">
              {data.phone}
            </div>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="flex items-center gap-2 text-sm text-[#D9DCE1]/70 mb-2">
            <Briefcase className="w-4 h-4 text-[#00E5FF]" />
            Role
          </label>
          <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-lg px-4 py-2.5 text-white">
            {data.role}
          </div>
        </div>

        {/* Company */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-[#D9DCE1]/70 mb-2">
            <Building className="w-4 h-4 text-[#00E5FF]" />
            Company
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editData.company}
              onChange={(e) => setEditData({ ...editData, company: e.target.value })}
              className="w-full bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
            />
          ) : (
            <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-lg px-4 py-2.5 text-white">
              {data.company}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
