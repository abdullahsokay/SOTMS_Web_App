import { Bell, Settings, User, LogOut, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';

interface TopNavProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
  onNavigate: (page: string) => void;
}

/**
 * An alert is "unresolved" (i.e. still demands attention, so it counts toward
 * the bell badge) unless it has been explicitly acknowledged or resolved.
 * The live Firestore schema (see AlertsPage.tsx) marks this via a `status`
 * field of 'unacknowledged' | 'acknowledged' | 'resolved'. We also tolerate
 * boolean flag variants (resolved / acknowledged / isAcknowledged) so the
 * badge stays correct if the schema is extended.
 */
function isAlertUnresolved(data: Record<string, unknown>): boolean {
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
  if (status === 'acknowledged' || status === 'resolved') return false;
  if (data.resolved === true) return false;
  if (data.acknowledged === true) return false;
  if (data.isAcknowledged === true) return false;
  return true;
}

export function TopNav({ onLogout, onToggleSidebar, onNavigate }: TopNavProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(0);

  // Live count of unresolved alerts from Firestore (drives the bell badge).
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'alerts'),
      (snapshot) => {
        const unresolved = snapshot.docs.filter((doc) => isAlertUnresolved(doc.data())).length;
        setNotifications(unresolved);
      },
      (error) => {
        console.error('[TopNav] Error subscribing to alerts:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const userLabel = auth.currentUser?.displayName || auth.currentUser?.email || 'User';

  return (
    <div className="h-16 bg-[#0C1E2C] border-b border-[#00E5FF]/20 flex items-center justify-between px-6">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 hover:bg-[#009FFD]/10 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-[#00E5FF]" />
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          onClick={() => onNavigate('alerts')}
          className="relative p-2 hover:bg-[#009FFD]/10 rounded-lg transition-all duration-200 hover:scale-105"
        >
          <Bell className="w-5 h-5 text-[#D9DCE1]" />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF4D4D] text-white text-xs rounded-full flex items-center justify-center neon-glow">
              {notifications}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => onNavigate('settings')}
          className="p-2 hover:bg-[#009FFD]/10 rounded-lg transition-all duration-200 hover:scale-105"
        >
          <Settings className="w-5 h-5 text-[#D9DCE1]" />
        </button>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 pr-4 hover:bg-[#009FFD]/10 rounded-lg transition-all duration-200 hover:scale-105 border border-[#00E5FF]/30"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-[#009FFD] to-[#00E5FF] rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-[#D9DCE1]">{userLabel}</span>
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg shadow-lg neon-glow z-50 animate-fade-in">
              <div className="p-2">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[#D9DCE1] hover:bg-[#009FFD]/20 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}