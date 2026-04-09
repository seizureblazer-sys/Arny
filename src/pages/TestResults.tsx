import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Filter, TrendingUp, Award, Target, BookOpen, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface TestResult {
  id: string;
  score: number;
  totalQuestions: number;
  subject: string;
  createdAt: string;
}

export default function TestResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof TestResult, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, 'test_results'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestResult));
      setResults(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching results", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const subjects = useMemo(() => Array.from(new Set(results.map(r => r.subject))), [results]);

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const totalExams = results.length;
    const avgScore = results.reduce((acc, r) => acc + (r.score / r.totalQuestions), 0) / totalExams;
    const highestScore = Math.max(...results.map(r => (r.score / r.totalQuestions) * 100));
    
    const subjectPerformance: Record<string, { total: number, count: number }> = {};
    results.forEach(r => {
      if (!subjectPerformance[r.subject]) subjectPerformance[r.subject] = { total: 0, count: 0 };
      subjectPerformance[r.subject].total += (r.score / r.totalQuestions);
      subjectPerformance[r.subject].count += 1;
    });

    const topSubject = Object.entries(subjectPerformance).reduce((a, b) => 
      (a[1].total / a[1].count) > (b[1].total / b[1].count) ? a : b
    )[0];

    return { totalExams, avgScore: (avgScore * 100).toFixed(1), highestScore: highestScore.toFixed(1), topSubject };
  }, [results]);

  const chartData = useMemo(() => {
    return results.slice().reverse().map(r => ({
      date: format(new Date(r.createdAt), 'MMM dd'),
      score: Math.round((r.score / r.totalQuestions) * 100),
      subject: r.subject
    }));
  }, [results]);

  const subjectChartData = useMemo(() => {
    const data: Record<string, { total: number, count: number }> = {};
    results.forEach(r => {
      if (!data[r.subject]) data[r.subject] = { total: 0, count: 0 };
      data[r.subject].total += (r.score / r.totalQuestions);
      data[r.subject].count += 1;
    });
    return Object.entries(data).map(([name, stats]) => ({
      name,
      score: Math.round((stats.total / stats.count) * 100)
    })).sort((a, b) => b.score - a.score);
  }, [results]);

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results.filter(r => {
      const matchesSubject = filterSubject === 'All' || r.subject === filterSubject;
      const matchesSearch = r.subject.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSubject && matchesSearch;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [results, filterSubject, sortConfig, searchTerm]);

  const handleSort = (key: keyof TestResult) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Target className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Results Yet</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Start taking mock tests in Exam Mode to see your performance analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Performance Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track your progress and identify areas for improvement.</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Exams</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats?.totalExams}</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Score</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats?.avgScore}%</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Highest Score</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats?.highestScore}%</h3>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Top Subject</p>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{stats?.topSubject}</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Score Progression</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Subject Performance</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={10} width={100} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                  {subjectChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Exam History</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select 
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="All">All Subjects</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th 
                  className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('subject')}
                >
                  <div className="flex items-center">
                    Subject
                    {sortConfig.key === 'subject' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />)}
                  </div>
                </th>
                <th 
                  className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center">
                    Score
                    {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />)}
                  </div>
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Percentage</th>
                <th 
                  className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center">
                    Date
                    {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />)}
                  </div>
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredAndSortedResults.map(r => {
                const percentage = Math.round((r.score / r.totalQuestions) * 100);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-900 dark:text-white">{r.subject}</div>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {r.score} / {r.totalQuestions}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              percentage >= 80 ? "bg-green-500" : percentage >= 50 ? "bg-blue-500" : "bg-red-500"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{percentage}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                      {format(new Date(r.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        percentage >= 50 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {percentage >= 50 ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
