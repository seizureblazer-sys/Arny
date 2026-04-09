import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, Clock, Edit2, Check, X, User as UserIcon, Loader2 as LoaderIcon, BarChart3, Users, Trophy, Settings, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  tier: string;
  role: string;
  minutesUsed: number;
  trialEndsAt: string;
  subscriptionEndsAt: string;
  unlockedFeatures: string[];
  sscYear?: string;
  hscYear?: string;
  whatsapp?: string;
  school?: string;
  college?: string;
  bio?: string;
  preparationScore?: number;
  isProfileComplete?: boolean;
}

interface MegaExam {
  id: string;
  title: string;
  startTime: string;
  duration: number;
  fee: number;
  status: 'upcoming' | 'active' | 'completed';
  resultsPublished: boolean;
  totalParticipants?: number;
}

export default function AdminDashboard() {
  const { userData } = useAuth();
  const { isAdminAuthenticated } = useAdminAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<UserDoc | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserDoc>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'exams'>('users');
  const [exams, setExams] = useState<MegaExam[]>([]);
  const [newExam, setNewExam] = useState<Partial<MegaExam>>({
    title: '',
    startTime: '',
    duration: 120,
    fee: 300,
    status: 'upcoming',
    resultsPublished: false
  });

  if (userData?.role !== 'admin' || !isAdminAuthenticated) {
    return <Navigate to="/" />;
  }

  const stats = {
    total: users.length,
    registered: users.filter(u => u.isProfileComplete).length,
    trial: users.filter(u => u.tier === 'trial').length,
    basic: users.filter(u => u.tier === 'suchona').length,
    pro: users.filter(u => u.tier === 'ogrogrami').length,
    elite: users.filter(u => u.tier === 'shirsho').length,
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDoc));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'mega_exams'), (snapshot) => {
      const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MegaExam));
      setExams(examsData);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateExam = async () => {
    if (!newExam.title || !newExam.startTime) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await addDoc(collection(db, 'mega_exams'), {
        ...newExam,
        createdAt: new Date().toISOString()
      });
      setNewExam({ title: '', startTime: '', duration: 120, fee: 300, status: 'upcoming', resultsPublished: false });
      toast.success("Exam created successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create exam");
    }
  };

  const handlePublishResults = async (examId: string) => {
    try {
      await updateDoc(doc(db, 'mega_exams', examId), { resultsPublished: true });
      toast.success("Results published to everyone!");
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (user: UserDoc) => {
    setEditingUser(user.id);
    setEditForm(user);
  };

  const handleSave = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), editForm);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user", error);
      toast.error("Failed to update user.");
    }
  };

  const toggleFeature = (feature: string) => {
    const currentFeatures = editForm.unlockedFeatures || [];
    if (currentFeatures.includes(feature)) {
      setEditForm({ ...editForm, unlockedFeatures: currentFeatures.filter(f => f !== feature) });
    } else {
      setEditForm({ ...editForm, unlockedFeatures: [...currentFeatures, feature] });
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  const tierData = [
    { name: 'Trial', value: stats.trial },
    { name: 'Basic', value: stats.basic },
    { name: 'Pro', value: stats.pro },
    { name: 'Elite', value: stats.elite },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Shield className="w-8 h-8 mr-3 text-red-500" />
            Admin Command Center
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Comprehensive student analytics and management.</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'users' ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Students
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'analytics' ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-2" />
            Analytics
          </button>
          <button 
            onClick={() => setActiveTab('exams')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'exams' ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Trophy className="w-4 h-4 inline-block mr-2" />
            Mega Exams
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Users', value: stats.total, color: 'blue' },
              { label: 'Profile Done', value: stats.registered, color: 'green' },
              { label: 'Trial', value: stats.trial, color: 'gray' },
              { label: 'Basic', value: stats.basic, color: 'indigo' },
              { label: 'Pro', value: stats.pro, color: 'orange' },
              { label: 'Elite', value: stats.elite, color: 'purple' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</div>
                <div className={`text-2xl font-bold text-${stat.color}-600 mt-1`}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search students by name or email..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Student</th>
                    <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Tier & Score</th>
                    <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Profile Status</th>
                    <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center"><LoaderIcon className="w-8 h-8 animate-spin mx-auto text-blue-600" /></td></tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold">
                            {user.displayName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{user.displayName || 'Anonymous'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase w-fit
                            ${user.tier === 'shirsho' ? 'bg-purple-100 text-purple-800' : 
                              user.tier === 'ogrogrami' ? 'bg-orange-100 text-orange-800' : 
                              user.tier === 'suchona' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {user.tier || 'trial'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500" 
                                style={{ width: `${user.preparationScore || 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-blue-600">{user.preparationScore || 0}%</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {user.isProfileComplete ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                            <Check className="w-3 h-3" /> Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-600">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setViewingUser(user)}
                            className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100"
                            title="View Profile"
                          >
                            <UserIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEdit(user)}
                            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
                            title="Edit Access"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Student Tier Distribution
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {tierData.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{tier.name}: {tier.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Preparation Score Analysis
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { range: '0-20%', count: users.filter(u => (u.preparationScore || 0) <= 20).length },
                  { range: '21-40%', count: users.filter(u => (u.preparationScore || 0) > 20 && (u.preparationScore || 0) <= 40).length },
                  { range: '41-60%', count: users.filter(u => (u.preparationScore || 0) > 40 && (u.preparationScore || 0) <= 60).length },
                  { range: '61-80%', count: users.filter(u => (u.preparationScore || 0) > 60 && (u.preparationScore || 0) <= 80).length },
                  { range: '81-100%', count: users.filter(u => (u.preparationScore || 0) > 80).length },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exams' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              Create New Mega Exam
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Exam Title</label>
                <input 
                  type="text" 
                  value={newExam.title}
                  onChange={e => setNewExam({...newExam, title: e.target.value})}
                  className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  placeholder="e.g. Weekly Mega Exam #12"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Start Time</label>
                <input 
                  type="datetime-local" 
                  value={newExam.startTime}
                  onChange={e => setNewExam({...newExam, startTime: e.target.value})}
                  className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Duration (mins)</label>
                <input 
                  type="number" 
                  value={newExam.duration}
                  onChange={e => setNewExam({...newExam, duration: parseInt(e.target.value)})}
                  className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Fee (BDT)</label>
                <input 
                  type="number" 
                  value={newExam.fee}
                  onChange={e => setNewExam({...newExam, fee: parseInt(e.target.value)})}
                  className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>
            <button 
              onClick={handleCreateExam}
              className="mt-6 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              Schedule Exam
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold">Manage Scheduled Exams</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {exams.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No exams scheduled yet.</div>
              ) : exams.map(exam => (
                <div key={exam.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{exam.title}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(exam.startTime).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {exam.totalParticipants || 0} Registered</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!exam.resultsPublished && exam.status === 'completed' && (
                      <button 
                        onClick={() => handlePublishResults(exam.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700"
                      >
                        Publish Results
                      </button>
                    )}
                    {exam.resultsPublished && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">Results Live</span>
                    )}
                    <button className="p-2 text-gray-400 hover:text-red-500">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">Student Profile</h3>
              <button onClick={() => setViewingUser(null)} className="p-2 hover:bg-white/20 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-3xl font-bold text-gray-400">
                  {viewingUser.displayName?.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white">{viewingUser.displayName}</h4>
                  <p className="text-gray-500">{viewingUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">SSC Year</div>
                  <div className="font-bold dark:text-white">{viewingUser.sscYear || 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">HSC Year</div>
                  <div className="font-bold dark:text-white">{viewingUser.hscYear || 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">WhatsApp</div>
                  <div className="font-bold dark:text-white">{viewingUser.whatsapp || 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Prep Score</div>
                  <div className="font-bold text-blue-600">{viewingUser.preparationScore || 0}%</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">School</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl font-medium dark:text-white">{viewingUser.school || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">College</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl font-medium dark:text-white">{viewingUser.college || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Bio</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-sm text-gray-600 dark:text-gray-300">{viewingUser.bio || 'No bio provided.'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Access Modal (Existing logic) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">Edit Access</h3>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/20 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Role</label>
                  <select 
                    value={editForm.role || 'user'} 
                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                    className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tier</label>
                  <select 
                    value={editForm.tier || 'trial'} 
                    onChange={e => setEditForm({...editForm, tier: e.target.value})}
                    className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  >
                    <option value="trial">Trial</option>
                    <option value="suchona">সূচনা (Basic)</option>
                    <option value="ogrogrami">অগ্রগামী (Pro)</option>
                    <option value="shirsho">শীর্ষ (Elite)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditingUser(null)} className="px-6 py-2 text-gray-500 font-bold">Cancel</button>
                <button onClick={() => handleSave(editingUser)} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function User(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
