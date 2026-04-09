import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Pricing } from './components/Pricing';
import { Download } from './components/Download';
import { Footer } from './components/Footer';
import { AccountPage } from './pages/AccountPage';
import { DevicesPage } from './pages/DevicesPage';
import { AdminPage } from './pages/AdminPage';

function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
      <Download />
      <Footer />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg text-text">
          <Nav />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/devices" element={<DevicesPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
