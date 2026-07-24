import { useState } from 'react';
import { Cpu, KeyRound, Copy, Check, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;

interface ProvisionResult {
  deviceId: string;
  secret: string;
}

/**
 * Admin-only panel: provisions an ESP device by calling the `provisionDevice`
 * Cloud Function, which returns a one-time secret to flash to the board.
 * The secret is shown once and never retrievable again.
 */
export function DeviceProvisioning() {
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const trimmed = deviceId.trim();
  const valid = DEVICE_ID_RE.test(trimmed);

  const handleProvision = async () => {
    setError(null);
    setResult(null);
    setCopied(false);
    if (!valid) {
      setError('Device ID must be 3–64 chars: letters, numbers, - or _.');
      return;
    }
    setLoading(true);
    try {
      const call = httpsCallable<{ deviceId: string }, ProvisionResult>(
        functions,
        'provisionDevice'
      );
      const res = await call({ deviceId: trimmed });
      setResult(res.data);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? '';
      const message = (e as { message?: string })?.message ?? 'Provisioning failed.';
      if (code.includes('permission-denied')) {
        setError('Admin role required to provision devices.');
      } else if (code.includes('unauthenticated')) {
        setError('You must be signed in.');
      } else if (code.includes('invalid-argument')) {
        setError('Invalid device ID.');
      } else if (code.includes('internal') || code.includes('not-found') || code.includes('unavailable')) {
        setError('Provisioning service unavailable — is the Cloud Function deployed?');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 neon-glow">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#00E5FF]/20">
        <div className="p-2 bg-[#009FFD]/20 rounded-lg">
          <Cpu className="w-5 h-5 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-xl text-white">Device Provisioning</h2>
          <p className="text-sm text-[#D9DCE1]/60">
            Issue an authentication secret for an ESP device (admin only)
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-[#D9DCE1] mb-2" htmlFor="provision-device-id">
            Device ID
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="provision-device-id"
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. TANKER-001"
              className="flex-1 bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-white placeholder:text-[#D9DCE1]/30 focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all"
            />
            <button
              onClick={handleProvision}
              disabled={loading || !valid}
              className="px-5 py-2.5 bg-gradient-to-r from-[#00FFFF] to-[#009FFD] hover:from-[#00E5FF] hover:to-[#007FFF] text-[#07121A] rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
              {loading ? 'Generating…' : 'Generate Secret'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-[#FF4D4D]/10 border border-[#FF4D4D]/40 rounded-lg text-[#FF4D4D] text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* One-time secret */}
        {result && (
          <div className="p-4 bg-[#07121A] border border-[#28B463]/40 rounded-xl space-y-3">
            <div className="flex items-start gap-2 text-[#FFB02E] text-sm">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Copy this secret now — it is shown <strong>once</strong> and cannot be
                retrieved again. Flash it to <strong>{result.deviceId}</strong>. Re-provision to rotate.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-[#00E5FF] text-sm font-mono">
                {result.secret}
              </code>
              <button
                onClick={copySecret}
                className="p-2.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 border border-[#00E5FF]/30 rounded-lg transition-colors"
                aria-label="Copy secret"
                title="Copy secret"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-[#28B463]" />
                ) : (
                  <Copy className="w-5 h-5 text-[#00E5FF]" />
                )}
              </button>
            </div>
            <p className="text-xs text-[#D9DCE1]/50">
              The device uses this secret with <code className="text-[#00E5FF]">mintDeviceToken</code> to
              obtain a Firebase token. See functions/DEVICE_AUTH.md.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
