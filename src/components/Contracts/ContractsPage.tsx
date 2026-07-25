import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import {
  Handshake,
  Plus,
  Trash2,
  X,
  Truck,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Power,
  Info,
} from 'lucide-react';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useGPSData } from '../../hooks/useGPSData';
import type { Contract } from '../../types/tenant';

/**
 * Contracts management (FLEET OWNER only).
 *
 * A fleet owner shares specific tankers with a contractor company by creating a
 * `contracts` document. While a contract is `active`, a Cloud Function keeps the
 * covered tankers' `visibleTo` array in sync so the contractor can read them
 * (Option A — active-contract-only visibility). This page just creates/manages
 * the contract documents; it never writes `visibleTo` directly.
 */
export function ContractsPage() {
  const { companyId, companyType, loading: companyLoading } = useCompany();
  const { tankers } = useGPSData();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast notifications.
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  // Subscribe to this company's contracts (fleet-owner scoped).
  useEffect(() => {
    if (companyType !== 'fleet_owner') {
      setContracts([]);
      setLoading(false);
      return;
    }
    if (!companyId) {
      setContracts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'contracts'),
      where('fleetOwnerCompanyId', '==', companyId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Contract));
        // Newest first (no orderBy so a missing composite index can't break the list).
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setContracts(rows);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading contracts:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [companyId, companyType]);

  // Resolve a tanker id to a friendly name from the live fleet, else fall back to the id.
  const tankerName = (id: string) => tankers.find((t) => t.id === id)?.name || id;

  const handleCreate = async (form: {
    contractorCompanyId: string;
    tankerIds: string[];
    startDate: string;
    endDate: string;
    active: boolean;
  }) => {
    if (!companyId) {
      showNotification('Account setup incomplete. Cannot create contract.', 'error');
      return;
    }
    const contractorCompanyId = form.contractorCompanyId.trim();
    if (!contractorCompanyId) {
      showNotification('Enter the contractor company id.', 'error');
      return;
    }
    if (form.tankerIds.length === 0) {
      showNotification('Select at least one tanker to share.', 'error');
      return;
    }
    try {
      await addDoc(collection(db, 'contracts'), {
        contractorCompanyId,
        fleetOwnerCompanyId: companyId,
        tankerIds: form.tankerIds,
        active: form.active,
        startDate: form.startDate,
        endDate: form.endDate || null,
        createdAt: new Date().toISOString(),
      });
      setShowModal(false);
      showNotification('Contract created successfully.', 'success');
    } catch (e) {
      console.error('Error creating contract:', e);
      showNotification('Failed to create contract. Please try again.', 'error');
    }
  };

  const handleToggleActive = async (contract: Contract) => {
    try {
      await updateDoc(doc(db, 'contracts', contract.id), { active: !contract.active });
      showNotification(
        !contract.active ? 'Contract activated.' : 'Contract paused.',
        'success'
      );
    } catch (e) {
      console.error('Error updating contract:', e);
      showNotification('Failed to update contract.', 'error');
    }
  };

  const handleDelete = async (contract: Contract) => {
    if (!window.confirm('Delete this contract? The contractor will lose visibility to these tankers.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'contracts', contract.id));
      showNotification('Contract deleted.', 'success');
    } catch (e) {
      console.error('Error deleting contract:', e);
      showNotification('Failed to delete contract.', 'error');
    }
  };

  // ── Non-fleet-owner / loading gates ──
  if (companyLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#07121A]">
        <div className="flex items-center gap-3 text-[#00E5FF]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="animate-pulse">Loading contracts...</span>
        </div>
      </div>
    );
  }

  if (companyType !== 'fleet_owner') {
    return (
      <div className="h-full flex items-center justify-center bg-[#07121A] p-6">
        <div className="max-w-md text-center bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-8 neon-glow">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-[#009FFD] to-[#00E5FF] flex items-center justify-center">
            <Handshake className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl text-white mb-2">Contracts are managed by fleet owners</h2>
          <p className="text-sm text-[#D9DCE1]/60">
            Contracts that share tankers with your company are created by the fleet owner.
            Shared tankers appear automatically in Live Tracking while a contract is active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#07121A] p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#009FFD] to-[#00E5FF] flex items-center justify-center shrink-0">
            <Handshake className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl text-white neon-text">Contracts</h1>
            <p className="text-sm text-[#D9DCE1]/60">
              Share specific tankers with a contractor company
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#28B463] hover:bg-[#28B463]/80 text-white transition-all duration-200 hover:scale-105 neon-glow"
        >
          <Plus className="w-5 h-5" />
          <span>New Contract</span>
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-[#00E5FF]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="animate-pulse">Loading contracts...</span>
          </div>
        </div>
      ) : contracts.length === 0 ? (
        <div className="max-w-lg mx-auto text-center bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-2xl p-10 mt-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#009FFD]/10 border border-[#00E5FF]/20 flex items-center justify-center">
            <Handshake className="w-7 h-7 text-[#00E5FF]" />
          </div>
          <h2 className="text-lg text-white mb-2">No contracts yet</h2>
          <p className="text-sm text-[#D9DCE1]/60 mb-5">
            Create a contract to give a contractor company read-only access to specific
            tankers while the contract is active.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#009FFD] hover:bg-[#009FFD]/80 text-white transition-all duration-200 hover:scale-105 neon-glow"
          >
            <Plus className="w-5 h-5" />
            <span>New Contract</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl p-5 flex flex-col gap-4 hover:border-[#00E5FF]/60 transition-all"
            >
              {/* Top row: contractor + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#D9DCE1]/50 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Contractor company
                  </div>
                  <div className="text-sm text-white font-mono break-all">
                    {contract.contractorCompanyId}
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs border ${
                    contract.active
                      ? 'bg-[#28B463]/10 border-[#28B463]/40 text-[#28B463]'
                      : 'bg-[#D9DCE1]/5 border-[#D9DCE1]/20 text-[#D9DCE1]/60'
                  }`}
                >
                  {contract.active ? 'Active' : 'Paused'}
                </span>
              </div>

              {/* Tankers */}
              <div>
                <div className="flex items-center gap-2 text-xs text-[#D9DCE1]/50 mb-2">
                  <Truck className="w-3.5 h-3.5 text-[#00E5FF]" />
                  {contract.tankerIds.length} tanker{contract.tankerIds.length === 1 ? '' : 's'} shared
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contract.tankerIds.map((tid) => (
                    <span
                      key={tid}
                      className="px-2 py-0.5 rounded-md bg-[#009FFD]/10 border border-[#00E5FF]/20 text-xs text-[#D9DCE1]"
                    >
                      {tankerName(tid)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 text-xs text-[#D9DCE1]/60">
                <Calendar className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>{contract.startDate || '—'}</span>
                <span className="text-[#D9DCE1]/30">→</span>
                <span>{contract.endDate || 'Ongoing'}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 mt-auto border-t border-[#00E5FF]/10">
                <button
                  onClick={() => handleToggleActive(contract)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 mt-3 rounded-lg text-sm transition-all duration-200 ${
                    contract.active
                      ? 'bg-[#D9DCE1]/10 hover:bg-[#D9DCE1]/20 text-[#D9DCE1]'
                      : 'bg-[#28B463]/15 hover:bg-[#28B463]/25 text-[#28B463] border border-[#28B463]/30'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {contract.active ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(contract)}
                  title="Delete contract"
                  className="flex items-center justify-center gap-2 px-3 py-2 mt-3 rounded-lg text-sm bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 text-[#FF4D4D] border border-[#FF4D4D]/30 transition-all duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Contract Modal */}
      {showModal && (
        <NewContractModal
          tankers={tankers}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg border animate-fade-in ${
            notification.type === 'success'
              ? 'bg-[#0C1E2C] border-[#28B463]/50 shadow-[0_0_20px_rgba(40,180,99,0.3)]'
              : 'bg-[#0C1E2C] border-[#FF4D4D]/50 shadow-[0_0_20px_rgba(255,77,77,0.3)]'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#28B463] flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-[#FF4D4D] flex-shrink-0" />
          )}
          <span className="text-sm text-white">{notification.message}</span>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// New Contract modal
// ──────────────────────────────────────────────
interface NewContractModalProps {
  tankers: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (form: {
    contractorCompanyId: string;
    tankerIds: string[];
    startDate: string;
    endDate: string;
    active: boolean;
  }) => void;
}

function NewContractModal({ tankers, onClose, onCreate }: NewContractModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [contractorCompanyId, setContractorCompanyId] = useState('');
  const [selectedTankers, setSelectedTankers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);

  const toggleTanker = (id: string) => {
    setSelectedTankers((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const canSubmit = contractorCompanyId.trim().length > 0 && selectedTankers.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({
      contractorCompanyId,
      tankerIds: selectedTankers,
      startDate,
      endDate,
      active,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">New Contract</h2>
              <p className="text-sm text-[#D9DCE1]/60">Share tankers with a contractor company</p>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-160px)] custom-scrollbar"
        >
          {/* Contractor company id */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00E5FF]" />
              Contractor Company ID
            </label>
            <input
              type="text"
              value={contractorCompanyId}
              onChange={(e) => setContractorCompanyId(e.target.value)}
              placeholder="Paste the contractor's company id"
              required
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all font-mono"
            />
            <div className="flex items-start gap-2 mt-2 text-xs text-[#D9DCE1]/50">
              <Info className="w-3.5 h-3.5 text-[#00E5FF] mt-0.5 shrink-0" />
              <span>Ask the contractor for their company id — they can find it in their account settings.</span>
            </div>
          </div>

          {/* Tanker multi-select */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#00E5FF]" />
              Tankers to share
              {selectedTankers.length > 0 && (
                <span className="ml-auto text-xs text-[#00E5FF]">{selectedTankers.length} selected</span>
              )}
            </label>
            {tankers.length === 0 ? (
              <div className="px-4 py-3 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg text-sm text-[#D9DCE1]/70">
                No live tankers available yet. Tankers appear here once their devices report in.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {tankers.map((tanker) => {
                  const checked = selectedTankers.includes(tanker.id);
                  return (
                    <button
                      key={tanker.id}
                      type="button"
                      onClick={() => toggleTanker(tanker.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                        checked
                          ? 'bg-[#009FFD]/20 border-[#00E5FF]/50 text-white neon-glow'
                          : 'bg-[#07121A] border-[#00E5FF]/20 text-[#D9DCE1] hover:bg-[#009FFD]/10'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                          checked ? 'bg-[#00E5FF] border-[#00E5FF]' : 'border-[#D9DCE1]/40'
                        }`}
                      >
                        {checked && <CheckCircle2 className="w-4 h-4 text-[#07121A]" />}
                      </span>
                      <span className="flex items-center gap-2 min-w-0">
                        <Truck className="w-4 h-4 text-[#00E5FF] shrink-0" />
                        <span className="truncate">{tanker.name}</span>
                      </span>
                      <span className="ml-auto text-[10px] text-[#D9DCE1]/40 font-mono truncate max-w-[40%]">
                        {tanker.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#28B463]" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
                className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-sm text-white mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF4D4D]" />
                End Date <span className="text-xs text-[#D9DCE1]/50">(optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
                className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Active toggle */}
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#07121A] border border-[#00E5FF]/20 rounded-lg transition-all hover:border-[#00E5FF]/40"
          >
            <span className="flex items-center gap-2 text-sm text-white">
              <Power className="w-4 h-4 text-[#00E5FF]" />
              Active on creation
            </span>
            <span
              className={`relative w-11 h-6 rounded-full transition-colors ${
                active ? 'bg-[#28B463]' : 'bg-[#D9DCE1]/20'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 px-6 py-3 rounded-lg transition-all duration-200 ${
                canSubmit
                  ? 'bg-[#28B463] hover:bg-[#28B463]/80 text-white hover:scale-105 neon-glow'
                  : 'bg-[#28B463]/30 text-white/50 cursor-not-allowed'
              }`}
            >
              {!contractorCompanyId.trim()
                ? 'Enter a contractor company id'
                : selectedTankers.length === 0
                ? 'Select at least one tanker'
                : 'Create Contract'}
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
