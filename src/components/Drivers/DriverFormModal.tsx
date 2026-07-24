import { useState } from 'react';
import { X, User, CreditCard, Phone, MapPin, FileText, Shield, UserPlus, Trash2, Loader2, Calendar } from 'lucide-react';
import { Driver, CoPilot } from '../../types';

interface DriverFormModalProps {
  driver: Driver | null;
  onClose: () => void;
  onSave: (data: Partial<Driver>) => Promise<void>;
}

export function DriverFormModal({ driver, onClose, onSave }: DriverFormModalProps) {
  const isEdit = !!driver;

  const [formData, setFormData] = useState({
    fullName: driver?.fullName || '',
    address: driver?.address || '',
    phone: driver?.phone || '+92-',
    cnic: driver?.cnic || '',
    licenseNumber: driver?.licenseNumber || '',
    licenseExpiry: driver?.licenseExpiry || '',
    status: driver?.status || 'active' as 'active' | 'inactive' | 'suspended',
  });

  const [insurance, setInsurance] = useState({
    insured: driver?.insurance?.insured || false,
    company: driver?.insurance?.company || '',
    policyNumber: driver?.insurance?.policyNumber || '',
    expiry: driver?.insurance?.expiry || '',
  });

  const [coPilots, setCoPilots] = useState<CoPilot[]>(driver?.coPilots || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CNIC auto-formatting: 00000-0000000-0
  const handleCnicChange = (value: string, target: 'main' | number = 'main') => {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    let formatted = digits;
    if (digits.length > 5) formatted = digits.slice(0, 5) + '-' + digits.slice(5);
    if (digits.length > 12) formatted = digits.slice(0, 5) + '-' + digits.slice(5, 12) + '-' + digits.slice(12);

    if (target === 'main') {
      setFormData(prev => ({ ...prev, cnic: formatted }));
    } else {
      updateCoPilot(target, 'cnic', formatted);
    }
  };

  // Phone auto-formatting: +92-XXX-XXXXXXX
  const handlePhoneChange = (value: string, target: 'main' | number = 'main') => {
    let digits = value.replace(/[^\d+]/g, '');
    // If starts with +92, strip it for processing
    if (digits.startsWith('+92')) digits = digits.slice(3);
    else if (digits.startsWith('92')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.replace(/\D/g, '').slice(0, 10);

    let formatted = '+92-';
    if (digits.length > 0) formatted += digits.slice(0, 3);
    if (digits.length > 3) formatted += '-' + digits.slice(3, 10);

    if (target === 'main') {
      setFormData(prev => ({ ...prev, phone: formatted }));
    } else {
      updateCoPilot(target, 'phone', formatted);
    }
  };

  // Co-pilot management
  const addCoPilot = () => {
    if (coPilots.length >= 3) return;
    setCoPilots([...coPilots, {
      coPilotId: `CP-${Date.now()}`,
      fullName: '',
      phone: '+92-',
      cnic: '',
      address: '',
      addedAt: new Date().toISOString(),
    }]);
  };

  const removeCoPilot = (index: number) => {
    setCoPilots(coPilots.filter((_, i) => i !== index));
  };

  const updateCoPilot = (index: number, field: string, value: string) => {
    const updated = [...coPilots];
    updated[index] = { ...updated[index], [field]: value };
    setCoPilots(updated);
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    else if (formData.fullName.trim().length < 3) newErrors.fullName = 'Name must be at least 3 characters';
    else if (!/^[a-zA-Z\s.]+$/.test(formData.fullName)) newErrors.fullName = 'Only letters, spaces, and dots allowed';

    if (!formData.address.trim()) newErrors.address = 'Address is required';
    else if (formData.address.trim().length < 10) newErrors.address = 'Address must be at least 10 characters';

    if (!formData.phone || formData.phone === '+92-') newErrors.phone = 'Phone number is required';
    else if (!/^\+92-\d{3}-\d{7}$/.test(formData.phone)) newErrors.phone = 'Format: +92-XXX-XXXXXXX';

    if (!formData.cnic) newErrors.cnic = 'CNIC is required';
    else if (!/^\d{5}-\d{7}-\d{1}$/.test(formData.cnic)) newErrors.cnic = 'Format: 00000-0000000-0';

    if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    if (!formData.licenseExpiry) newErrors.licenseExpiry = 'License expiry date is required';

    if (insurance.insured) {
      if (!insurance.company.trim()) newErrors.insuranceCompany = 'Insurance company is required';
      if (!insurance.policyNumber.trim()) newErrors.insurancePolicyNumber = 'Policy number is required';
      if (!insurance.expiry) newErrors.insuranceExpiry = 'Insurance expiry is required';
    }

    coPilots.forEach((cp, i) => {
      if (!cp.fullName.trim()) newErrors[`cp${i}Name`] = 'Name is required';
      if (!cp.cnic || !/^\d{5}-\d{7}-\d{1}$/.test(cp.cnic)) newErrors[`cp${i}Cnic`] = 'Invalid CNIC format';
      if (!cp.phone || cp.phone === '+92-' || !/^\+92-\d{3}-\d{7}$/.test(cp.phone)) newErrors[`cp${i}Phone`] = 'Invalid phone';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const driverData: Partial<Driver> = {
        fullName: formData.fullName.trim(),
        address: formData.address.trim(),
        phone: formData.phone,
        cnic: formData.cnic,
        licenseNumber: formData.licenseNumber.trim().toUpperCase(),
        licenseExpiry: formData.licenseExpiry,
        status: formData.status,
        insurance: insurance.insured ? {
          insured: true,
          company: insurance.company.trim(),
          policyNumber: insurance.policyNumber.trim().toUpperCase(),
          expiry: insurance.expiry,
        } : null,
        coPilots,
        updatedAt: new Date().toISOString(),
      };

      if (!isEdit) {
        driverData.createdAt = new Date().toISOString();
        driverData.stats = { totalTrips: 0, totalDistance: 0, safetyScore: 100, lastAssignment: null };
      }

      await onSave(driverData);
      onClose();
    } catch (err) {
      console.error('Error saving driver:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all";
  const labelClass = "text-sm text-white mb-2 flex items-center gap-2";
  const errorClass = "text-[#FF4D4D] text-xs mt-1";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">{isEdit ? 'Edit Driver' : 'Add New Driver'}</h2>
              <p className="text-sm text-[#D9DCE1]/60">
                {isEdit ? `Editing ${driver.fullName}` : 'Register a new fleet driver'}
              </p>
            </div>
            <button onClick={onClose} title="Close" className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all">
              <X className="w-6 h-6 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-xs text-[#00E5FF] uppercase tracking-wider font-medium">Personal Information</h3>
            <div>
              <label className={labelClass}>
                <User className="w-4 h-4 text-[#00E5FF]" /> Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Enter full name"
                className={inputClass}
              />
              {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
            </div>
            <div>
              <label className={labelClass}>
                <MapPin className="w-4 h-4 text-[#00E5FF]" /> Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter full address"
                rows={2}
                className={`${inputClass} resize-none`}
              />
              {errors.address && <p className={errorClass}>{errors.address}</p>}
            </div>
          </div>

          {/* Contact & Identity */}
          <div className="space-y-4">
            <h3 className="text-xs text-[#00E5FF] uppercase tracking-wider font-medium">Contact & Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <CreditCard className="w-4 h-4 text-[#00E5FF]" /> CNIC
                </label>
                <input
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => handleCnicChange(e.target.value)}
                  placeholder="00000-0000000-0"
                  className={inputClass}
                />
                {errors.cnic && <p className={errorClass}>{errors.cnic}</p>}
              </div>
              <div>
                <label className={labelClass}>
                  <Phone className="w-4 h-4 text-[#00E5FF]" /> Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+92-XXX-XXXXXXX"
                  className={inputClass}
                />
                {errors.phone && <p className={errorClass}>{errors.phone}</p>}
              </div>
            </div>
          </div>

          {/* License */}
          <div className="space-y-4">
            <h3 className="text-xs text-[#00E5FF] uppercase tracking-wider font-medium">License Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <FileText className="w-4 h-4 text-[#00E5FF]" /> License Number
                </label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                  placeholder="License number"
                  className={inputClass}
                />
                {errors.licenseNumber && <p className={errorClass}>{errors.licenseNumber}</p>}
              </div>
              <div>
                <label className={labelClass}>
                  <Calendar className="w-4 h-4 text-[#00E5FF]" /> License Expiry
                </label>
                <input
                  type="date"
                  value={formData.licenseExpiry}
                  onChange={(e) => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                  aria-label="License expiry date"
                  className={inputClass}
                />
                {errors.licenseExpiry && <p className={errorClass}>{errors.licenseExpiry}</p>}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-xs text-[#00E5FF] uppercase tracking-wider font-medium mb-3">Status</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['active', 'inactive', 'suspended'] as const).map((s) => {
                const colors: Record<string, string> = {
                  active: '#28B463',
                  inactive: '#D9DCE1',
                  suspended: '#FF4D4D',
                };
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                    className={`px-4 py-3 rounded-lg transition-all duration-200 hover:scale-105 capitalize text-sm ${
                      formData.status === s
                        ? 'text-white neon-glow'
                        : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/20'
                    }`}
                    style={formData.status === s ? { backgroundColor: colors[s], borderColor: colors[s] } : {}}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Insurance */}
          <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-[#00E5FF] uppercase tracking-wider font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" /> Insurance
              </h3>
              <button
                type="button"
                onClick={() => setInsurance(prev => ({ ...prev, insured: !prev.insured }))}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                  insurance.insured ? 'bg-[#28B463]' : 'bg-[#D9DCE1]/30'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-200 ${
                  insurance.insured ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {insurance.insured && (
              <div className="space-y-3 animate-fade-in">
                <div>
                  <label className={labelClass}>Insurance Company</label>
                  <input
                    type="text"
                    value={insurance.company}
                    onChange={(e) => setInsurance(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Company name"
                    className={inputClass}
                  />
                  {errors.insuranceCompany && <p className={errorClass}>{errors.insuranceCompany}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Policy Number</label>
                    <input
                      type="text"
                      value={insurance.policyNumber}
                      onChange={(e) => setInsurance(prev => ({ ...prev, policyNumber: e.target.value }))}
                      placeholder="Policy #"
                      className={inputClass}
                    />
                    {errors.insurancePolicyNumber && <p className={errorClass}>{errors.insurancePolicyNumber}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Insurance Expiry</label>
                    <input
                      type="date"
                      value={insurance.expiry}
                      onChange={(e) => setInsurance(prev => ({ ...prev, expiry: e.target.value }))}
                      aria-label="Insurance expiry date"
                      className={inputClass}
                    />
                    {errors.insuranceExpiry && <p className={errorClass}>{errors.insuranceExpiry}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Co-Pilots */}
          <div className="bg-[#07121A] border border-[#00E5FF]/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-[#00E5FF] uppercase tracking-wider font-medium flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Co-Pilots ({coPilots.length}/3)
              </h3>
              {coPilots.length < 3 && (
                <button
                  type="button"
                  onClick={addCoPilot}
                  className="px-3 py-1.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg transition-all text-xs flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Add Co-Pilot
                </button>
              )}
            </div>

            {coPilots.length === 0 ? (
              <div className="text-center py-4 text-[#D9DCE1]/40 text-sm">
                No co-pilots added. Click "Add Co-Pilot" to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {coPilots.map((cp, i) => (
                  <div key={cp.coPilotId} className="bg-[#0C1E2C] border border-[#00E5FF]/10 rounded-lg p-3 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-[#00E5FF]">Co-Pilot #{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCoPilot(i)}
                        title="Remove co-pilot"
                        className="p-1 hover:bg-[#FF4D4D]/20 rounded text-[#FF4D4D] transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          value={cp.fullName}
                          onChange={(e) => updateCoPilot(i, 'fullName', e.target.value)}
                          placeholder="Full name"
                          className={`${inputClass} text-sm py-2`}
                        />
                        {errors[`cp${i}Name`] && <p className={errorClass}>{errors[`cp${i}Name`]}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={cp.cnic}
                          onChange={(e) => handleCnicChange(e.target.value, i)}
                          placeholder="CNIC"
                          className={`${inputClass} text-sm py-2`}
                        />
                        {errors[`cp${i}Cnic`] && <p className={errorClass}>{errors[`cp${i}Cnic`]}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={cp.phone}
                          onChange={(e) => handlePhoneChange(e.target.value, i)}
                          placeholder="Phone"
                          className={`${inputClass} text-sm py-2`}
                        />
                        {errors[`cp${i}Phone`] && <p className={errorClass}>{errors[`cp${i}Phone`]}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={cp.address || ''}
                          onChange={(e) => updateCoPilot(i, 'address', e.target.value)}
                          placeholder="Address (optional)"
                          className={`${inputClass} text-sm py-2`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-[#28B463] hover:bg-[#28B463]/80 text-white rounded-lg transition-all duration-200 hover:scale-105 neon-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                isEdit ? 'Update Driver' : 'Create Driver'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[#D9DCE1]/20 hover:bg-[#D9DCE1]/30 text-[#D9DCE1] rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
