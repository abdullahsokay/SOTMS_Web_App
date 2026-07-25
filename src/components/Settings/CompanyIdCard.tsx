import { useState } from 'react';
import { Building2, Copy, Check } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';

/**
 * Shows the signed-in user's Company ID with a copy button. A contractor gives
 * this id to a fleet owner so the fleet owner can create a contract that shares
 * tankers with them; a fleet owner can share it likewise. This is the value the
 * Contracts form asks for.
 */
export function CompanyIdCard() {
  const { companyId, companyType } = useCompany();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!companyId) return;
    try {
      await navigator.clipboard.writeText(companyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  const typeLabel =
    companyType === 'fleet_owner' ? 'Fleet Owner'
    : companyType === 'contractor' ? 'Contractor'
    : '—';

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-6 neon-glow">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#00E5FF]/20">
        <div className="p-2 bg-[#009FFD]/20 rounded-lg">
          <Building2 className="w-5 h-5 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-xl text-white">Company</h2>
          <p className="text-sm text-[#D9DCE1]/60">
            Account type: <span className="text-[#00E5FF]">{typeLabel}</span>
          </p>
        </div>
      </div>

      <label className="block text-sm text-[#D9DCE1] mb-2">
        Company ID
        <span className="text-[#D9DCE1]/50"> — share this to be linked in a contract</span>
      </label>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all bg-[#07121A] border border-[#00E5FF]/20 rounded-lg px-3 py-2.5 text-[#00E5FF] text-sm font-mono">
          {companyId ?? '(no company — please re-register)'}
        </code>
        <button
          onClick={copy}
          disabled={!companyId}
          className="p-2.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 border border-[#00E5FF]/30 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Copy company ID"
          title="Copy company ID"
        >
          {copied ? <Check className="w-5 h-5 text-[#28B463]" /> : <Copy className="w-5 h-5 text-[#00E5FF]" />}
        </button>
      </div>
    </div>
  );
}
