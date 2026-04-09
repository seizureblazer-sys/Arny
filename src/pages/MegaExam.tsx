import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Users, Clock, Calendar, CheckCircle, AlertCircle, Loader2, CreditCard, ChevronRight, Star, Medal, BarChart3, Award, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface MegaExamDoc {
  id: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  fee: number;
  status: 'pending' | 'approved' | 'completed';
  createdAt: string;
  registrationCount?: number;
  resultsPublished?: boolean;
}

interface Registration {
  id: string;
  userId: string;
  examId: string;
  status: 'registered' | 'paid' | 'completed';
  score?: number;
  userName?: string;
}

export default function MegaExam() {
  const { user, userData } = useAuth();
  const [exams, setExams] = useState<MegaExamDoc[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'mega_exams'), orderBy('startTime', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MegaExamDoc));
      setExams(examsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'mega_exam_registrations'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const regsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
      setRegistrations(regsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch leaderboard for published results
  useEffect(() => {
    const publishedExam = exams.find(e => e.resultsPublished);
    if (publishedExam) {
      const q = query(
        collection(db, 'mega_exam_registrations'),
        where('examId', '==', publishedExam.id),
        orderBy('score', 'desc'),
        limit(10)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLeaderboard(data);
      });
      return () => unsubscribe();
    }
  }, [exams]);

  const isRegistered = (examId: string) => registrations.some(r => r.examId === examId);

  const handleRegister = async (exam: MegaExamDoc) => {
    if (!user) return;
    setRegistering(exam.id);
    try {
      await addDoc(collection(db, 'mega_exam_registrations'), {
        examId: exam.id,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        status: 'paid',
        registeredAt: new Date().toISOString()
      });
      
      await updateDoc(doc(db, 'mega_exams', exam.id), {
        registrationCount: (exam.registrationCount || 0) + 1
      });

      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'Mega Exam Registration',
        message: `You're in! Get ready for ${exam.title}.`,
        type: 'success',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Successfully registered!');
    } catch (error) {
      console.error(error);
      toast.error('Registration failed.');
    } finally {
      setRegistering(null);
    }
  };

  const activeExam = exams.find(e => e.status === 'approved');
  const publishedExam = exams.find(e => e.resultsPublished);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-900 p-8 sm:p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-sm font-bold">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Weekly Mega Challenge
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
              BCS Standard <br />
              <span className="text-blue-200">AI Mega Exam</span>
            </h1>
            <p className="text-lg text-blue-100/80 font-medium">
              Compete with thousands of aspirants in a real-time, weekly exam. 
              Get your national ranking and detailed performance analysis.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                <Users className="w-5 h-5 text-blue-300" />
                <span className="font-bold">10k+ Participants</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                <Award className="w-5 h-5 text-yellow-300" />
                <span className="font-bold">Total Prize: ৳50,000</span>
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="w-64 h-64 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 animate-pulse">
              <Trophy className="w-32 h-32 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Public Results Dashboard (Admin Approved) */}
          {publishedExam && (
            <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Medal className="w-6 h-6" />
                    Official Results: {publishedExam.title}
                  </h2>
                  <p className="text-green-100 text-sm">Admin Approved Public Leaderboard</p>
                </div>
                <BarChart3 className="w-8 h-8 opacity-20" />
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {leaderboard.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No results available yet.</p>
                  ) : leaderboard.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                          index === 0 ? "bg-yellow-100 text-yellow-700" :
                          index === 1 ? "bg-gray-200 text-gray-700" :
                          index === 2 ? "bg-orange-100 text-orange-700" : "bg-white dark:bg-gray-800 text-gray-500"
                        )}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{entry.userName || 'Aspirant'}</p>
                          <p className="text-xs text-gray-500">Score: {entry.score || 0}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-600">Rank #{index + 1}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">National</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Active/Upcoming Exam Card */}
          {activeExam ? (
            <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{activeExam.title}</h2>
                    <p className="text-gray-500 mt-1">Standard BCS Preliminary Format (200 Questions)</p>
                  </div>
                  <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm">
                    ৳{activeExam.fee} Entry Fee
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <Calendar className="w-5 h-5 text-blue-500 mb-2" />
                    <p className="text-xs text-gray-500 uppercase font-bold">Date</p>
                    <p className="font-bold dark:text-white">{new Date(activeExam.startTime).toLocaleDateString()}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <Clock className="w-5 h-5 text-indigo-500 mb-2" />
                    <p className="text-xs text-gray-500 uppercase font-bold">Time</p>
                    <p className="font-bold dark:text-white">{new Date(activeExam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <Users className="w-5 h-5 text-green-500 mb-2" />
                    <p className="text-xs text-gray-500 uppercase font-bold">Registered</p>
                    <p className="font-bold dark:text-white">{activeExam.registrationCount || 0}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <Award className="w-5 h-5 text-purple-500 mb-2" />
                    <p className="text-xs text-gray-500 uppercase font-bold">Duration</p>
                    <p className="font-bold dark:text-white">{activeExam.durationMinutes} Mins</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <h3 className="font-bold text-gray-900 dark:text-white">Exam Rules:</h3>
                  <ul className="space-y-2">
                    {['200 Multiple Choice Questions', '0.5 Negative marking for each wrong answer', 'Exam starts exactly at scheduled time', 'No retakes allowed for Mega Exam'].map((rule, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                {isRegistered(activeExam.id) ? (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg shadow-green-200 dark:shadow-none cursor-default">
                      Already Registered
                    </button>
                    <button className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2">
                      Enter Exam Hall <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleRegister(activeExam)}
                    disabled={registering === activeExam.id}
                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                  >
                    {registering === activeExam.id ? 'Registering...' : `Register Now (৳${activeExam.fee})`}
                  </button>
                )}
              </div>
            </section>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-gray-100 dark:border-gray-700 text-center space-y-4">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No Active Mega Exams</h2>
              <p className="text-gray-500">Check back later for the next weekly challenge.</p>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Info */}
        <div className="space-y-8">
          {/* Your Progress */}
          <section className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Your Performance
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Average Score</span>
                  <span className="font-bold dark:text-white">72%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '72%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">National Percentile</span>
                  <span className="font-bold dark:text-white">85th</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: '85%' }} />
                </div>
              </div>
              <div className="pt-4 grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Exams Taken</p>
                  <p className="text-xl font-bold dark:text-white">12</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Best Rank</p>
                  <p className="text-xl font-bold text-green-600">#42</p>
                </div>
              </div>
            </div>
          </section>

          {/* Hall of Fame */}
          <section className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Previous Winners
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Ariful Islam', score: 188, rank: 1, avatar: 'A' },
                { name: 'Nusrat Jahan', score: 185, rank: 2, avatar: 'N' },
                { name: 'Tanvir Ahmed', score: 182, rank: 3, avatar: 'T' },
              ].map((winner) => (
                <div key={winner.rank} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-400">
                    {winner.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold dark:text-white">{winner.name}</p>
                    <p className="text-[10px] text-gray-500">Score: {winner.score}</p>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                    winner.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                    winner.rank === 2 ? "bg-gray-100 text-gray-700" : "bg-orange-100 text-orange-700"
                  )}>
                    #{winner.rank}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
