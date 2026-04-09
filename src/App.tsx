import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TeachMode from './pages/TeachMode';
import PracticeMode from './pages/PracticeMode';
import ExamMode from './pages/ExamMode';
import InterviewMode from './pages/InterviewMode';
import NewsPipeline from './pages/NewsPipeline';
import Pricing from './pages/Pricing';
import AdminDashboard from './pages/AdminDashboard';
import TestResults from './pages/TestResults';
import ProfileSetup from './pages/ProfileSetup';
import MegaExam from './pages/MegaExam';
import Login from './pages/Login';

const ProfileCheck = ({ children }: { children: React.ReactNode }) => {
  const { userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (userData && !userData.isProfileComplete && window.location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" />;
  }
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <ProfileCheck>{children}</ProfileCheck>;
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <Toaster position="top-right" />
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route path="teach" element={<TeachMode />} />
                  <Route path="practice" element={<PracticeMode />} />
                  <Route path="exam" element={<ExamMode />} />
                  <Route path="mega-exam" element={<MegaExam />} />
                  <Route path="interview" element={<InterviewMode />} />
                  <Route path="pipeline" element={<NewsPipeline />} />
                  <Route path="pricing" element={<Pricing />} />
                  <Route path="admin" element={<AdminDashboard />} />
                  <Route path="results" element={<TestResults />} />
                </Route>
              </Routes>
            </Router>
          </AdminAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
