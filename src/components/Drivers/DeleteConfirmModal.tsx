import { AlertTriangle, UserX, Trash2, X } from 'lucide-react';
import { Driver } from '../../types';

interface DeleteConfirmModalProps {
  driver: Driver;
  hasActiveRoute: boolean;
  onClose: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}

export function DeleteConfirmModal({ driver, hasActiveRoute, onClose, onDeactivate, onDelete }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#FF4D4D]/30 rounded-2xl max-w-md w-full mx-4 neon-glow animate-scale-in">
        {/* Header */}
        <div className="flex justify-end p-3 pb-0">
          <button onClick={onClose} className="p-1.5 hover:bg-[#009FFD]/20 rounded-lg transition-all">
            <X className="w-5 h-5 text-[#D9DCE1]" />
          </button>
        </div>

        {/* Warning Icon & Message */}
        <div className="px-6 pb-2 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#FF4D4D]/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-[#FF4D4D]" />
          </div>
          <h3 className="text-xl text-white mb-2">Remove Driver</h3>
          <p className="text-[#D9DCE1]/70 text-sm">
            What would you like to do with <span className="text-white font-medium">{driver.fullName}</span>?
          </p>
          <p className="text-[#D9DCE1]/50 text-xs mt-1">
            CNIC: {driver.cnic}
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-4 space-y-3">
          {/* Deactivate (Recommended) */}
          <button
            onClick={() => { onDeactivate(); onClose(); }}
            className="w-full px-4 py-3 bg-[#FFB02E]/20 border border-[#FFB02E]/40 text-[#FFB02E] rounded-lg hover:bg-[#FFB02E]/30 transition-all flex items-center gap-3"
          >
            <UserX className="w-5 h-5 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-sm">Deactivate (Recommended)</div>
              <div className="text-xs opacity-70">Set status to inactive. Can be reactivated later.</div>
            </div>
          </button>

          {/* Permanent Delete */}
          <button
            onClick={() => {
              if (hasActiveRoute) return;
              onDelete();
              onClose();
            }}
            disabled={hasActiveRoute}
            className={`w-full px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
              hasActiveRoute
                ? 'bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 text-[#FF4D4D]/50 cursor-not-allowed'
                : 'bg-[#FF4D4D]/20 border border-[#FF4D4D]/40 text-[#FF4D4D] hover:bg-[#FF4D4D]/30'
            }`}
          >
            <Trash2 className="w-5 h-5 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-sm">Delete Permanently</div>
              <div className="text-xs opacity-70">
                {hasActiveRoute
                  ? 'Cannot delete — driver assigned to active route'
                  : 'Remove all driver records. Cannot be undone.'}
              </div>
            </div>
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#D9DCE1]/10 text-[#D9DCE1] rounded-lg hover:bg-[#D9DCE1]/20 transition-all text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
