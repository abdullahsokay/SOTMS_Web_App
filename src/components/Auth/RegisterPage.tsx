import { useState } from 'react';
import { Droplet, Building, MapPin, Truck, User, CreditCard, Phone, Mail, Lock, UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import type { CompanyType } from '../../types/tenant';

interface RegisterPageProps {
  onRegister: (data: any) => void;
  onNavigateToLogin: () => void;
  backgroundImage: string;
}

export function RegisterPage({ onRegister, onNavigateToLogin, backgroundImage }: RegisterPageProps) {
  const [formData, setFormData] = useState({
    companyName: '',
    companyLocation: '',
    companyType: 'fleet_owner' as CompanyType,
    fleetSize: '',
    fullName: '',
    cnic: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
    setGeneralError(null);
  };

  const validateForm = () => {
    const newErrors: any = {};

    const isFleetOwner = formData.companyType === 'fleet_owner';

    if (!formData.companyName) newErrors.companyName = 'Company name is required';
    if (!formData.companyLocation) newErrors.companyLocation = 'Company location is required';
    // Fleet size only applies to fleet owners (contractors own no tankers).
    if (isFleetOwner && !formData.fleetSize) newErrors.fleetSize = 'Fleet size is required';

    if (!formData.fullName) {
      newErrors.fullName = 'Full name is required';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.fullName)) {
      newErrors.fullName = 'Full name should only contain characters';
    }

    // CNIC only required for fleet owners; contractors are corporate accounts.
    if (isFleetOwner) {
      if (!formData.cnic) {
        newErrors.cnic = 'CNIC is required';
      } else if (!/^\d{13}$/.test(formData.cnic)) {
        newErrors.cnic = 'CNIC must be exactly 13 digits';
      }
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone is required';
    } else if (!/^\d{11}$/.test(formData.phone)) {
      newErrors.phone = 'Phone number must be exactly 11 digits';
    }

    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Valid email is required';
    }
    if (formData.username.length < 4 || formData.username.length > 8) {
      newErrors.username = 'Username must be 4-8 characters';
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError(null);

    try {
      // 1. Create User in Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      const companyId = user.uid; // this account founds the company; id = uid

      // 2a. Create the company this account owns
      await setDoc(doc(db, "companies", companyId), {
        ownerUid: user.uid,
        name: formData.companyName,
        location: formData.companyLocation,
        type: formData.companyType,
        fleetSize: formData.fleetSize ? Number(formData.fleetSize) : null,
        createdAt: new Date().toISOString(),
      });

      // 2b. Create the founding admin user, linked to the company
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        companyId,
        companyType: formData.companyType,
        role: 'admin', // company admin (scoped by companyId)
        companyName: formData.companyName,
        companyLocation: formData.companyLocation,
        fleetSize: formData.fleetSize,
        fullName: formData.fullName,
        cnic: formData.cnic,
        phone: formData.phone,
        email: formData.email,
        username: formData.username, // Keeping username in DB though Auth uses email
        createdAt: new Date().toISOString(),
      });

      // 3. Notify Parent Component
      onRegister({ ...formData, uid: user.uid });

    } catch (error: any) {
      console.error("Registration Error:", error);
      let errorMessage = "Registration failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email is already registered.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      }
      setGeneralError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="absolute inset-0 bg-[#07121A]/80 backdrop-blur-sm" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 229, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Register Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-2xl animate-fade-in">
          {/* Card */}
          <div className="bg-[#0C1E2C]/90 backdrop-blur-lg border border-[#00E5FF]/30 rounded-2xl p-8 neon-glow">
            {/* Logo & Title */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#009FFD] to-[#00E5FF] rounded-2xl flex items-center justify-center mb-3 animate-scale-in">
                <Droplet className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl text-white neon-text mb-1">Create Account</h1>
              <p className="text-sm text-[#D9DCE1]/60">Register your company with SOTMS</p>
            </div>

            {/* Error Message */}
            {generalError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm text-center">
                {generalError}
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Information */}
              <div>
                <h3 className="text-sm text-[#00E5FF] mb-3">Company Information</h3>

                {/* Account type — fleet owner vs contractor */}
                <div className="mb-4">
                  <label className="block text-xs text-[#D9DCE1]/70 mb-2">Account Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, companyType: 'fleet_owner' })}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${formData.companyType === 'fleet_owner' ? 'bg-[#009FFD]/20 border-[#00E5FF]/50' : 'bg-[#07121A] border-[#00E5FF]/20 hover:border-[#00E5FF]/40'}`}
                    >
                      <span className="flex items-center gap-2 text-sm text-white"><Truck className="w-4 h-4 text-[#00E5FF]" /> Fleet Owner</span>
                      <span className="text-[11px] text-[#D9DCE1]/60">I own tankers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, companyType: 'contractor' })}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${formData.companyType === 'contractor' ? 'bg-[#009FFD]/20 border-[#00E5FF]/50' : 'bg-[#07121A] border-[#00E5FF]/20 hover:border-[#00E5FF]/40'}`}
                    >
                      <span className="flex items-center gap-2 text-sm text-white"><Building className="w-4 h-4 text-[#00E5FF]" /> Contractor</span>
                      <span className="text-[11px] text-[#D9DCE1]/60">I give oil contracts (PSO, Shell…)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        placeholder="Company Name"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                    </div>
                    {errors.companyName && <p className="text-[#FF4D4D] text-xs mt-1">{errors.companyName}</p>}
                  </div>

                  <div>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type="text"
                        name="companyLocation"
                        value={formData.companyLocation}
                        onChange={handleChange}
                        placeholder="Company Location"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                    </div>
                    {errors.companyLocation && <p className="text-[#FF4D4D] text-xs mt-1">{errors.companyLocation}</p>}
                  </div>

                  {formData.companyType === 'fleet_owner' && (
                    <div className="md:col-span-2">
                      <div className="relative">
                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                        <input
                          type="number"
                          name="fleetSize"
                          value={formData.fleetSize}
                          onChange={handleChange}
                          placeholder="Number of Fleet/Vehicles"
                          className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                        />
                      </div>
                      {errors.fleetSize && <p className="text-[#FF4D4D] text-xs mt-1">{errors.fleetSize}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="text-sm text-[#00E5FF] mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="Full Name"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                    </div>
                    {errors.fullName && <p className="text-[#FF4D4D] text-xs mt-1">{errors.fullName}</p>}
                  </div>

                  {formData.companyType === 'fleet_owner' && (
                    <div>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                        <input
                          type="text"
                          name="cnic"
                          value={formData.cnic}
                          onChange={handleChange}
                          placeholder="CNIC"
                          className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                        />
                      </div>
                      {errors.cnic && <p className="text-[#FF4D4D] text-xs mt-1">{errors.cnic}</p>}
                    </div>
                  )}

                  <div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Phone Number"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                    </div>
                    {errors.phone && <p className="text-[#FF4D4D] text-xs mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Email Address"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                    </div>
                    {errors.email && <p className="text-[#FF4D4D] text-xs mt-1">{errors.email}</p>}
                  </div>
                </div>
              </div>

              {/* Account Credentials */}
              <div>
                <h3 className="text-sm text-[#00E5FF] mb-3">Account Credentials</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Username (4-8 characters)"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                    </div>
                    {errors.username && <p className="text-[#FF4D4D] text-xs mt-1">{errors.username}</p>}
                  </div>

                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Password (min 6 characters)"
                        className="w-full pl-10 pr-12 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D9DCE1]/60 hover:text-[#00E5FF] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[#FF4D4D] text-xs mt-1">{errors.password}</p>}
                  </div>

                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm Password"
                        className="w-full pl-10 pr-12 py-2.5 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D9DCE1]/60 hover:text-[#00E5FF] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-[#FF4D4D] text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg flex items-center justify-center gap-2 neon-glow transition-all duration-200 hover:scale-105 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                {isLoading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center text-sm text-[#D9DCE1]/70">
              Already have an account?{' '}
              <button
                onClick={onNavigateToLogin}
                className="text-[#00E5FF] hover:underline"
              >
                Login here
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-xs text-[#D9DCE1]/50">
            © 2025 SOTMS. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}