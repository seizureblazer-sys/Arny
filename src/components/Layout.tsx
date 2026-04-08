import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BookOpen, PenTool, FileText, Mic, LayoutDashboard, LogOut, Settings, Shield, CreditCard, Moon, Sun, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { user, userData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const location = useLocation();

  const navItems = [
    { name: language === 'en' ? 'Dashboard' : 'ড্যাশবোর্ড', path: '/', icon: LayoutDashboard },
    { name: language === 'en' ? 'Teach Mode' : 'টিচ মোড', path: '/teach', icon: BookOpen },
    { name: language === 'en' ? 'Practice Mode' : 'অনুশীলন', path: '/practice', icon: PenTool },
    { name: language === 'en' ? 'Exam Mode' : 'পরীক্ষা', path: '/exam', icon: FileText },
    { name: language === 'en' ? 'Interview Mode' : 'ভাইভা', path: '/interview', icon: Mic },
    { name: language === 'en' ? 'Upgrade' : 'আপগ্রেড', path: '/pricing', icon: CreditCard },
  ];

  if (userData?.role === 'admin') {
    navItems.push({ name: 'News Processor', path: '/pipeline', icon: Settings });
    navItems.push({ name: 'Admin Dashboard', path: '/admin', icon: Shield });
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">BCS Hub</h1>
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 transition-colors">
        <main className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
