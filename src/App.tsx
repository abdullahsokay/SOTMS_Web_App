import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useTheme } from './contexts/ThemeContext';
import { Sidebar } from './components/Layout/Sidebar';
import { TopNav } from './components/Layout/TopNav';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { LiveTrackingPage } from './components/Tracking/LiveTrackingPage';
import { ReportsPage } from './components/Reports/ReportsPage';
import { LoginPage } from './components/Auth/LoginPage';
import { RegisterPage } from './components/Auth/RegisterPage';
import { FuelLoadPage } from './components/FuelLoad/FuelLoadPage';
import { RouteManagementPage } from './components/Routes/RouteManagementPage';
import { AlertsPage } from './components/Alerts/AlertsPage';
import { SettingsPage } from './components/Settings/SettingsPage';
import { DriverManagementPage } from './components/Drivers/DriverManagementPage';
import { DriverBehaviourPage } from './components/Drivers/DriverBehaviourPage';

type AppPage = 'login' | 'register' | 'dashboard' | 'tracking' | 'fuel' | 'routes' | 'drivers' | 'behaviour' | 'alerts' | 'reports' | 'settings';

export default function App() {
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    const saved = localStorage.getItem('sotms_page');
    const validPages: AppPage[] = ['login', 'register', 'dashboard', 'tracking', 'fuel', 'routes', 'drivers', 'behaviour', 'alerts', 'reports', 'settings'];
    return (validPages.includes(saved as AppPage) ? saved as AppPage : 'login');
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSidebar, setShowSidebar] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isLoading, setIsLoading] = useState(true);

  const backgroundImage = 'https://images.unsplash.com/photo-1636364247421-bf6d912e74bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvaWwlMjB0YW5rZXIlMjB0cnVjayUyMGhpZ2h3YXl8ZW58MXx8fHwxNzY0MDY2ODkxfDA&ixlib=rb-4.1.0&q=80&w=1080';

  useEffect(() => {
    localStorage.setItem('sotms_page', currentPage);
  }, [currentPage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setCurrentPage((prev) => {
          if (prev === 'login' || prev === 'register') return 'dashboard';
          return prev;
        });
      } else {
        setIsAuthenticated(false);
        setCurrentPage('login');
        localStorage.removeItem('sotms_page');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    console.log('Login triggered');
  };

  const handleRegister = () => {
    console.log('Register triggered');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAuthenticated(false);
    setCurrentPage('login');
    localStorage.removeItem('sotms_page');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as AppPage);
    // Auto-close the drawer after navigating on mobile.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07121A] flex items-center justify-center">
        <div className="text-[#00E5FF] animate-pulse">Loading SOTMS...</div>
      </div>
    );
  }

  // Render auth pages
  if (!isAuthenticated) {
    if (currentPage === 'register') {
      return (
        <RegisterPage
          onRegister={handleRegister}
          onNavigateToLogin={() => setCurrentPage('login')}
          backgroundImage={backgroundImage}
        />
      );
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        onNavigateToRegister={() => setCurrentPage('register')}
        backgroundImage={backgroundImage}
      />
    );
  }

  // Render main app layout
  return (
    <div className={`flex h-screen overflow-hidden transition-all duration-300 bg-[#07121A] ${theme === 'light' ? 'light-mode' : ''}`}>
      {/* Desktop sidebar — normal in-flow column, hidden on mobile */}
      {showSidebar && (
        <div className="hidden lg:block shrink-0">
          <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
        </div>
      )}

      {/* Mobile sidebar — overlay drawer, hidden on desktop */}
      {showSidebar && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setShowSidebar(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-40">
            <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <TopNav onLogout={handleLogout} onToggleSidebar={() => setShowSidebar(!showSidebar)} onNavigate={handleNavigate} />

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="h-full transition-opacity duration-300">
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'tracking' && <LiveTrackingPage />}
            {currentPage === 'reports' && <ReportsPage />}
            {currentPage === 'fuel' && <FuelLoadPage />}
            {currentPage === 'routes' && <RouteManagementPage />}
            {currentPage === 'drivers' && <DriverManagementPage />}
            {currentPage === 'behaviour' && <DriverBehaviourPage />}
            {currentPage === 'alerts' && <AlertsPage />}
            {currentPage === 'settings' && <SettingsPage />}
          </div>
        </div>
      </div>
    </div>
  );
}
