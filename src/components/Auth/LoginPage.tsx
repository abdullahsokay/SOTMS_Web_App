import { useState, useEffect } from 'react';
import { Droplet, Mail, Lock, LogIn, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
  onNavigateToRegister: () => void;
  backgroundImage: string;
}

export function LoginPage({ onLogin, onNavigateToRegister, backgroundImage }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<any>({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Restore only the email for prefill — never the password.
  // Also purge any legacy plaintext-password entry written by older builds.
  useEffect(() => {
    localStorage.removeItem('sotms_remember');
    const savedEmail = localStorage.getItem('sotms_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const validateForm = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Persist only the email; Firebase manages session persistence.
      if (rememberMe) {
        localStorage.setItem('sotms_remember_email', email);
      } else {
        localStorage.removeItem('sotms_remember_email');
      }
      onLogin(email, password);
    } catch (error: any) {
      console.error("Login Error:", error);
      let errorMessage = "Login failed. Please try again.";

      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password. If you don't have an account, please register.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      }

      setGeneralError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    setIsResetting(true);
    setResetMessage(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage({ type: 'success', text: 'Password reset link sent! Check your email.' });
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetMessage(null);
        setResetEmail('');
      }, 3000);
    } catch (error: any) {
      console.error("Reset Error:", error);
      if (error.code === 'auth/user-not-found') {
        setResetMessage({ type: 'error', text: 'This email does not exist.' });
      } else if (error.code === 'auth/invalid-email') {
        setResetMessage({ type: 'error', text: 'Invalid email address.' });
      } else {
        setResetMessage({ type: 'error', text: 'Failed to send reset link. Try again.' });
      }
    } finally {
      setIsResetting(false);
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

      {/* Login Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Card */}
          <div className="bg-[#0C1E2C]/90 backdrop-blur-lg border border-[#00E5FF]/30 rounded-2xl p-8 neon-glow">
            {/* Logo & Title */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#009FFD] to-[#00E5FF] rounded-2xl flex items-center justify-center mb-4 animate-scale-in">
                <Droplet className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl text-white neon-text mb-2">SOTMS</h1>
              <p className="text-[#D9DCE1]/60">Smart Oil Transport Monitoring System</p>
            </div>

            {/* General Error Message */}
            {generalError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm text-center">
                {generalError}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm text-[#D9DCE1] mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00E5FF]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setGeneralError(null);
                    }}
                    placeholder="Enter your email"
                    className="w-full pl-11 pr-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF] transition-all"
                  />
                </div>
                {errors.email && (
                  <p className="text-[#FF4D4D] text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-[#D9DCE1] mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00E5FF]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setGeneralError(null);
                    }}
                    placeholder="Enter password"
                    className="w-full pl-11 pr-12 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D9DCE1]/60 hover:text-[#00E5FF] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[#FF4D4D] text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-[#D9DCE1]/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#009FFD] rounded"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    if (email) setResetEmail(email);
                  }}
                  className="text-[#00E5FF] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg flex items-center justify-center gap-2 neon-glow transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {isLoading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            {/* Register Link */}
            <div className="mt-6 text-center text-sm text-[#D9DCE1]/70">
              Don't have an account?{' '}
              <button
                onClick={onNavigateToRegister}
                className="text-[#00E5FF] hover:underline"
              >
                Register here
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-xs text-[#D9DCE1]/50">
            © 2025 SOTMS. All rights reserved.
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowForgotPassword(false)}
              title="Close"
              className="absolute right-4 top-4 text-[#D9DCE1]/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl text-white font-bold mb-2">Reset Password</h2>
            <p className="text-[#D9DCE1]/70 text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>

            {resetMessage && (
              <div className={`mb-4 p-3 rounded text-sm text-center ${resetMessage.type === 'success' ? 'bg-green-500/20 text-green-200 border border-green-500' : 'bg-red-500/20 text-red-200 border border-red-500'}`}>
                {resetMessage.text}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-[#D9DCE1] mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00E5FF]" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-11 pr-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/40 focus:outline-none focus:border-[#00E5FF] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-3 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] text-white rounded-lg flex items-center justify-center gap-2 neon-glow transition-all duration-200 hover:scale-105 disabled:opacity-50"
              >
                {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}