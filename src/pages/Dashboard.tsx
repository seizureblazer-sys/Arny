import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, orderBy, limit, getDocs, where, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Flame, Target, BookOpen, Award, Edit2, X, Loader2, Calendar, Key, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ReminderManager from '../components/ReminderManager';

interface GKPoint {
  id: string;
  subject: string;
  topic: string;
  current_affair: string;
  static_gk_link: string;
}

interface GKProgress {
  id: string;
  gkPointId: string;
  nextReviewDate: string;
  interval: number;
  lastRating: string;
}

interface Exam {
  id: string;
  title: string;
  date: string;
  description?: string;
}

export default function Dashboard() {
  const { user, userData, updateUserProfile } = useAuth();
  const { language } = useLanguage();
  const [recentGK, setRecentGK] = useState<GKPoint[]>([]);
  const [gkProgress, setGkProgress] = useState<GKProgress[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingExams, setLoadingExams] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editExam, setEditExam] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    const fetchGK = async () => {
      try {
        const q = query(collection(db, 'gk_points'), orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        const points = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GKPoint));
        setRecentGK(points);
      } catch (error) {
        console.error("Error fetching GK points", error);
      } finally {
        setLoading(false);
      }
    };
    const fetchProgress = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'gk_progress'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const progress = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GKProgress));
        setGkProgress(progress);
      } catch (error) {
        console.error("Error fetching GK progress", error);
      }
    };
    const fetchExams = async () => {
      try {
        const now = new Date().toISOString();
        const q = query(collection(db, 'exams'), where('date', '>=', now), orderBy('date', 'asc'), limit(5));
        const snapshot = await getDocs(q);
        const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        setUpcomingExams(examsData);
      } catch (error) {
        console.error("Error fetching exams", error);
      } finally {
        setLoadingExams(false);
      }
    };

    fetchGK();
    fetchProgress();
    fetchExams();
  }, [user]);

  const handleRate = async (gkPointId: string, rating: 'Easy' | 'Good' | 'Hard') => {
    if (!user) return;
    const now = new Date();
    let interval = 1;
    if (rating === 'Easy') interval = 7;
    else if (rating === 'Good') interval = 3;
    
    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(now.getDate() + interval);
    
    const progressRef = gkProgress.find(p => p.gkPointId === gkPointId);
    try {
      if (progressRef) {
        await updateDoc(doc(db, 'gk_progress', progressRef.id), {
          nextReviewDate: nextReviewDate.toISOString(),
          interval,
          lastRating: rating
        });
      } else {
        await addDoc(collection(db, 'gk_progress'), {
          userId: user.uid,
          gkPointId,
          nextReviewDate: nextReviewDate.toISOString(),
          interval,
          lastRating: rating
        });
      }
      toast.success(`Scheduled for ${nextReviewDate.toLocaleDateString()}`);
      // Refresh progress
      const q = query(collection(db, 'gk_progress'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      setGkProgress(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GKProgress)));
    } catch (error) {
      console.error("Error updating progress", error);
      toast.error("Failed to update progress.");
    }
  };

  const isDue = (gkPointId: string) => {
    const progress = gkProgress.find(p => p.gkPointId === gkPointId);
    if (!progress) return true; // Due if never reviewed
    return new Date(progress.nextReviewDate) <= new Date();
  };

  const handleEditClick = () => {
    setEditName(user?.displayName || '');
    setEditExam(userData?.targetExam || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(editName, editExam);
      setIsEditingProfile(false);
    } catch (error) {
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateCode = async () => {
    if (!authCodeInput.trim() || !user || !userData) return;
    setIsActivating(true);
    try {
      if (userData.authCode === authCodeInput.trim() && userData.authCodeExpiresAt && new Date() < new Date(userData.authCodeExpiresAt)) {
        const deviceId = localStorage.getItem('deviceId');
        await updateDoc(doc(db, 'users', user.uid), {
          tier: userData.pendingTier,
          subscriptionEndsAt: userData.pendingSubscriptionEndsAt,
          unlockedFeatures: userData.pendingUnlockedFeatures,
          boundDeviceId: deviceId,
          authCode: null,
          authCodeExpiresAt: null,
          pendingTier: null,
          pendingSubscriptionEndsAt: null,
          pendingUnlockedFeatures: null
        });
        alert("Device authorized and features unlocked successfully!");
        setAuthCodeInput('');
      } else {
        alert("Invalid or expired authorization code.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to activate code.");
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {language === 'en' ? `Welcome back, ${user?.displayName?.split(' ')[0]}!` : `স্বাগতম, ${user?.displayName?.split(' ')[0]}!`}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {language === 'en' ? "Here's your preparation overview for today." : "আজকের জন্য আপনার প্রস্তুতির ওভারভিউ।"}
          </p>
        </div>
        <button 
          onClick={handleEditClick}
          className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          {language === 'en' ? 'Edit Profile' : 'প্রোফাইল সম্পাদনা'}
        </button>
      </div>

      {userData?.authCode && userData?.authCodeExpiresAt && new Date() < new Date(userData.authCodeExpiresAt) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mr-4 shrink-0">
              <Key className="w-6 h-6 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Activate Your Device</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">Enter the 6-digit authorization code sent by the admin to unlock premium features on this device.</p>
            </div>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <input 
              type="text" 
              placeholder="Enter 6-digit code" 
              value={authCodeInput}
              onChange={(e) => setAuthCodeInput(e.target.value)}
              className="px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:text-white w-full md:w-48"
              maxLength={6}
            />
            <button 
              onClick={handleActivateCode}
              disabled={isActivating || authCodeInput.length < 6}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isActivating ? 'Verifying...' : 'Activate'}
            </button>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
              <button onClick={() => setIsEditingProfile(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Exam</label>
                <input 
                  type="text" 
                  value={editExam} 
                  onChange={(e) => setEditExam(e.target.value)}
                  placeholder="e.g., 50th BCS"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button 
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving || !editName.trim() || !editExam.trim()}
                className="flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Current Streak</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{userData?.streak || 0} Days</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Target Exam</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{userData?.targetExam || 'Not Set'}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Questions Solved</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">124</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => window.location.href = '/results'}>
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Past Results</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">View History</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today's GK Feed</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Curated current affairs linked to static GK</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading today's GK...</div>
            ) : recentGK.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">No GK points generated yet. Check the News Pipeline.</div>
            ) : (
              recentGK.map((gk) => (
                <div key={gk.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                      {gk.subject}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{gk.topic}</span>
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium mb-2">{gk.current_affair}</p>
                  <div className="flex items-start space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/50 mb-4">
                    <BookOpen className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200"><span className="font-semibold">Static Link:</span> {gk.static_gk_link}</p>
                  </div>
                  
                  {isDue(gk.id) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">How was your recall?</span>
                      <button onClick={() => handleRate(gk.id, 'Hard')} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm">Hard</button>
                      <button onClick={() => handleRate(gk.id, 'Good')} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm">Good</button>
                      <button onClick={() => handleRate(gk.id, 'Easy')} className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm">Easy</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="mt-6">
            <ReminderManager />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-fit">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Exams</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Important dates to remember</p>
            </div>
            <Calendar className="text-blue-500 w-5 h-5" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {loadingExams ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading exams...</div>
            ) : upcomingExams.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">No upcoming exams scheduled.</div>
            ) : (
              upcomingExams.map((exam) => (
                <div key={exam.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <h3 className="text-gray-900 dark:text-white font-medium">{exam.title}</h3>
                  {exam.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{exam.description}</p>}
                  <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium border border-blue-100 dark:border-blue-900/50">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(exam.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
