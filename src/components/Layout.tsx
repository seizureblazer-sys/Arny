import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { BookOpen, PenTool, FileText, Mic, LayoutDashboard, LogOut, Settings, Shield, CreditCard, Moon, Sun, Globe, Menu, X, Award, Trophy, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import NotificationCenter from './NotificationCenter';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user, userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { isAdminAuthenticated, authenticateAdmin } = useAdminAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setShowAdminLogin(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);
    if (newClicks >= 10) {
      setShowAdminLogin(true);
      setLogoClicks(0);
    }
    // Reset clicks after 3 seconds of inactivity
    setTimeout(() => setLogoClicks(0), 3000);
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticateAdmin(adminPassword)) {
      toast.success('Admin access granted');
      setShowAdminLogin(false);
      setAdminPassword('');
    } else {
      toast.error('Invalid password');
    }
  };

  const navItems = [
    { name: language === 'en' ? 'Dashboard' : 'ড্যাশবোর্ড', path: '/', icon: LayoutDashboard },
    { name: language === 'en' ? 'Teach Mode' : 'টিচ মোড', path: '/teach', icon: BookOpen },
    { name: language === 'en' ? 'Practice Mode' : 'অনুশীলন', path: '/practice', icon: PenTool },
    { name: language === 'en' ? 'Exam Mode' : 'পরীক্ষা', path: '/exam', icon: FileText },
    { name: language === 'en' ? 'Mega Exam' : 'মেগা এক্সাম', path: '/mega-exam', icon: Trophy },
    { name: language === 'en' ? 'Interview Mode' : 'ভাইভা', path: '/interview', icon: Mic },
    { name: language === 'en' ? 'Test Results' : 'ফলাফল', path: '/results', icon: Award },
    { name: language === 'en' ? 'Upgrade' : 'আপগ্রেড', path: '/pricing', icon: CreditCard },
  ];

  if (userData?.role === 'admin' && isAdminAuthenticated) {
    navItems.push({ name: 'News Processor', path: '/pipeline', icon: Settings });
    navItems.push({ name: 'Admin Dashboard', path: '/admin', icon: Shield });
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col transition-colors shrink-0">
        <div className="p-6 cursor-pointer select-none" onClick={handleLogoClick}>
          <div className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">BCS Hub</h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Smart Preparation Platform</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-400 dark:text-gray-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex justify-between items-center px-2">
            <button onClick={toggleTheme} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={toggleLanguage} className="flex items-center p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors font-medium text-sm">
              <Globe className="w-4 h-4 mr-1" />
              {language.toUpperCase()}
            </button>
          </div>
          
          <div className="flex items-center">
            <img 
              src={user?.photoURL || 'https://via.placeholder.com/40'} 
              alt="Profile" 
              className="h-10 w-10 rounded-full"
            />
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            {language === 'en' ? 'Sign Out' : 'লগ আউট'}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 z-50 lg:hidden transform transition-transform duration-300 ease-in-out flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex justify-between items-center">
          <div className="cursor-pointer select-none" onClick={handleLogoClick}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">BCS Hub</h1>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Smart Preparation Platform</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-400 dark:text-gray-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex justify-between items-center px-2">
            <button onClick={toggleTheme} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={toggleLanguage} className="flex items-center p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors font-medium text-sm">
              <Globe className="w-4 h-4 mr-1" />
              {language.toUpperCase()}
            </button>
          </div>
          <button 
            onClick={logout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            {language === 'en' ? 'Sign Out' : 'লগ আউট'}
          </button>
        </div>
      </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Desktop Header */}
          <header className="hidden lg:flex h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 items-center justify-end px-8 shrink-0 z-30">
            <NotificationCenter />
          </header>

          {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shrink-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={handleLogoClick}>
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">BCS Hub</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <img 
              src={user?.photoURL || 'https://via.placeholder.com/32'} 
              alt="Profile" 
              className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700"
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
            <Outlet />
          </div>
          
          {/* Main Footer */}
          <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-12 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-3xl shadow-inner">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">BCS Hub</span>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300 italic font-serif text-center max-w-md leading-relaxed">
                  "Dreaming to Fulfill Dreams"
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-px w-12 bg-blue-500/20" />
                  <div className="text-sm text-gray-400 dark:text-gray-500 flex flex-col items-center gap-1">
                    <span className="font-medium">© {new Date().getFullYear()} BCS Hub. All rights reserved.</span>
                    <span className="text-xs font-bold text-blue-600/80 dark:text-blue-400/80 uppercase tracking-widest">Developed by W@hd</span>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 flex justify-around items-center h-16 px-2 z-40">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] mt-1 font-medium truncate w-full text-center px-1">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto p-6 border-t border-gray-100 dark:border-gray-700">
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">
              "Dreaming to Fulfill Dreams"
            </p>
            <div className="h-px w-8 bg-blue-500/30 mx-auto" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Developed by <span className="text-blue-600 dark:text-blue-400 font-bold">W@hd</span>
            </p>
          </div>
        </div>
      </div>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="bg-gray-900 p-8 text-white text-center relative">
                <button 
                  onClick={() => setShowAdminLogin(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold">Admin Verification</h3>
                <p className="text-gray-400 mt-2">Enter secret credentials to proceed</p>
              </div>
              <form onSubmit={handleAdminAuth} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Secret Password</label>
                  <input
                    type="password"
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white font-mono"
                    placeholder="••••••••••••"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  Access Dashboard
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
