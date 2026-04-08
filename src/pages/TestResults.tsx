import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Filter } from 'lucide-react';

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

  useEffect(() => {
    const fetchResults = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'test_results'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestResult));
        setResults(data);
      } catch (error) {
        console.error("Error fetching results", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [user]);

  const subjects = Array.from(new Set(results.map(r => r.subject)));
  const filteredResults = filterSubject === 'All' 
    ? results 
    : results.filter(r => r.subject === filterSubject);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Past Test Results</h1>
      
      <div className="flex items-center gap-4 mb-6">
        <Filter className="w-5 h-5 text-gray-500" />
        <select 
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
        >
          <option value="All">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="p-4">Subject</th>
                <th className="p-4">Score</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map(r => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="p-4">{r.subject}</td>
                  <td className="p-4">{r.score} / {r.totalQuestions}</td>
                  <td className="p-4">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
