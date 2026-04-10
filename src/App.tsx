import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Features } from './components/Features';
import { Comparison } from './components/Comparison';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { Download } from './components/Download';
import { Footer } from './components/Footer';
import { AccountLayout } from './components/AccountLayout';
import { AccountAuthGate } from './pages/AccountPage';
import { AccountDashboard } from './pages/AccountDashboard';
import { AccountDownload } from './pages/AccountDownload';
import { AccountFeedback } from './pages/AccountFeedback';
import { AccountSubscription } from './pages/AccountSubscription';
import { DevicesPage } from './pages/DevicesPage';
import { AccountSettings } from './pages/AccountSettings';
import { AdminPage } from './pages/AdminPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';

function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Comparison />
      <Pricing />
      <FAQ />
      <Download />
      <Footer />
    </>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="pt-24 flex justify-center"><p className="text-text-muted">Loading\u2026</p></div>;
  if (!user) return <AccountAuthGate />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg text-text">
          <Nav />
          <Routes>
            <Route path="/" element={<HomePage />} />

            {/* Account dashboard — requires auth */}
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AccountDashboard />} />
              <Route path="download" element={<AccountDownload />} />
              <Route path="feedback" element={<AccountFeedback />} />
              <Route path="subscription" element={<AccountSubscription />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="settings" element={<AccountSettings />} />
              <Route path="*" element={<Navigate to="/account" replace />} />
            </Route>

            <Route path="/admin" element={<AdminPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
