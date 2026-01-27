import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { PublicAssessment } from './pages/PublicAssessment';
import { PublicFraudAlertsPage } from './pages/PublicFraudAlertsPage';
import { PublicResourcesPage } from './pages/PublicResourcesPage';
import { LoginPage } from './pages/LoginPage';
import { PlatformDashboard } from './pages/platform-admin/PlatformDashboard';
import { CompanyDashboard } from './pages/company-admin/CompanyDashboard';
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';

type Page = 'landing' | 'public-assessment' | 'fraud-alerts' | 'login' | 'dashboard';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  useEffect(() => {
    if (!loading && user) {
      setCurrentPage('dashboard');
    }
  }, [user, loading]);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && currentPage === 'dashboard') {
    switch (user.role) {
      case 'PLATFORM_ADMIN':
        return <PlatformDashboard onNavigate={handleNavigate} />;
      case 'COMPANY_ADMIN':
        return <CompanyDashboard onNavigate={handleNavigate} />;
      case 'EMPLOYEE':
        return <EmployeeDashboard onNavigate={handleNavigate} />;
      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  }

  switch (currentPage) {
    case 'public-assessment':
      return <PublicAssessment onNavigate={handleNavigate} />;
    case 'fraud-alerts':
      return <PublicFraudAlertsPage onNavigate={handleNavigate} />;
    case 'resources':
      return <PublicResourcesPage onNavigate={handleNavigate} />; 
    case 'login':
      return <LoginPage onNavigate={handleNavigate} />;
    case 'landing':
    default:
      return <LandingPage onNavigate={handleNavigate} />;
  }
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
