import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Flame, Target, BookOpen, Award, Edit2, X, Loader2, Calendar, Key, Check, Gift, ListTodo, Sparkles, Clock } from 'lucide-react';
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
  easeFactor: number;
  repetitionCount: number;
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
  const [latestResult, setLatestResult] = useState<{ score: number, totalQuestions: number, subject: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingExams, setLoadingExams] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editExam, setEditExam] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [studyPlan, setStudyPlan] = useState<any[]>([]);
  const [weakSubjects, setWeakSubjects] = useState<string[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);

  const [editSsc, setEditSsc] = useState('');
  const [editHsc, setEditHsc] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState('');

  useEffect(() => {
    if (!user) return;

    const qGK = query(collection(db, 'gk_points'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeGK = onSnapshot(qGK, (snapshot) => {
      const points = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GKPoint));
      setRecentGK(points);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching GK points", error);
      setLoading(false);
    });

    const qProgress = query(collection(db, 'gk_progress'), where('userId', '==', user.uid));
    const unsubscribeProgress = onSnapshot(qProgress, (snapshot) => {
      const progress = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GKProgress));
      setGkProgress(progress);
    }, (error) => {
      console.error("Error fetching GK progress", error);
    });

    const now = new Date().toISOString();
    const qExams = query(collection(db, 'exams'), where('date', '>=', now), orderBy('date', 'asc'), limit(5));
    const unsubscribeExams = onSnapshot(qExams, (snapshot) => {
      const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setUpcomingExams(examsData);
      setLoadingExams(false);
    }, (error) => {
      console.error("Error fetching exams", error);
      setLoadingExams(false);
    });

    const qLatestResult = query(collection(db, 'test_results'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(1));
    const unsubscribeLatestResult = onSnapshot(qLatestResult, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as any;
        setLatestResult({
          score: data.score,
          totalQuestions: data.totalQuestions,
          subject: data.subject
        });
      }
    });

    return () => {
      unsubscribeGK();
      unsubscribeProgress();
      unsubscribeExams();
      unsubscribeLatestResult();
    };
  }, [user]);

  const generateStudyPlan = async () => {
    if (!user) return;
    setIsGeneratingPlan(true);
    setStudyPlan([]);
    try {
      // Fetch all results to find weak subjects
      const resultsSnap = await getDocs(query(collection(db, 'test_results'), where('userId', '==', user.uid)));
      const subjectScores: Record<string, { total: number, count: number }> = {};
      
      resultsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!subjectScores[data.subject]) subjectScores[data.subject] = { total: 0, count: 0 };
        subjectScores[data.subject].total += (data.score / data.totalQuestions) * 100;
        subjectScores[data.subject].count += 1;
      });

      const weak = Object.entries(subjectScores)
        .map(([sub, data]) => ({ subject: sub, avg: data.total / data.count }))
        .filter(s => s.avg < 70)
        .sort((a, b) => a.avg - b.avg)
        .map(s => s.subject);
      
      setWeakSubjects(weak);

      const systemPrompt = `Generate a personalized daily study plan for a BCS aspirant. Return a JSON array of objects with 'task', 'duration', and 'priority' (High, Medium, Low).`;
      const prompt = `
        User Data:
        - Target Exam: ${userData?.targetExam || 'BCS'}
        - Preparation Score: ${userData?.preparationScore || 0}%
        - Weak Subjects: ${weak.join(', ') || 'General knowledge, Math, English'}
        - Upcoming Exams: ${upcomingExams.map(e => `${e.title} on ${e.date}`).join(', ')}
        
        Provide 3-4 specific tasks for today.
      `;

      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemPrompt })
      });

      if (!response.ok) throw new Error('AI Stream failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.substring(2));
                accumulatedText += text;
              } catch (e) {}
            }
          }
        }
      }

      try {
        const startIdx = accumulatedText.indexOf('[');
        const endIdx = accumulatedText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = accumulatedText.substring(startIdx, endIdx + 1);
          const plan = JSON.parse(jsonStr);
          setStudyPlan(plan);
        }
      } catch (e) {
        console.error("JSON Parse Error", e);
      }
    } catch (error) {
      console.error("Error generating study plan:", error);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  useEffect(() => {
    if (user && userData && upcomingExams.length > 0 && studyPlan.length === 0 && !isGeneratingPlan) {
      generateStudyPlan();
    }
  }, [user, userData, upcomingExams]);

  const toggleTask = (idx: number) => {
    setCompletedTasks(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
    if (!completedTasks.includes(idx)) {
      toast.success('Task completed! Keep going.');
    }
  };

  const handleRate = async (gkPointId: string, rating: 'Forgot' | 'Hard' | 'Good' | 'Easy') => {
    if (!user) return;
    
    const progressRef = gkProgress.find(p => p.gkPointId === gkPointId);
    
    // Map rating to SM-2 quality (0-5)
    const qualityMap = { 'Forgot': 0, 'Hard': 1, 'Good': 3, 'Easy': 5 };
    const q = qualityMap[rating];
    
    let { interval, easeFactor, repetitionCount } = progressRef || { interval: 0, easeFactor: 2.5, repetitionCount: 0 };
    
    if (q < 3) {
      repetitionCount = 0;
      interval = 1;
    } else {
      if (repetitionCount === 0) interval = 1;
      else if (repetitionCount === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      
      repetitionCount++;
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    }
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    
    try {
      const progressData = {
        userId: user.uid,
        gkPointId,
        nextReviewDate: nextReviewDate.toISOString(),
        interval,
        easeFactor,
        repetitionCount,
        lastRating: rating
      };

      if (progressRef) {
        await updateDoc(doc(db, 'gk_progress', progressRef.id), progressData);
      } else {
        await addDoc(collection(db, 'gk_progress'), progressData);
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

  // Sort GK points: Due items first
  const sortedGK = [...recentGK].sort((a, b) => {
    const aDue = isDue(a.id);
    const bDue = isDue(b.id);
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return 0;
  });

  const handleEditClick = () => {
    setEditName(user?.displayName || '');
    setEditExam(userData?.targetExam || '');
    setEditSsc(userData?.sscYear || '');
    setEditHsc(userData?.hscYear || '');
    setEditWhatsapp(userData?.whatsapp || '');
    setEditBio(userData?.bio || '');
    setEditPhoto(user?.photoURL || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user!.uid), {
        displayName: editName,
        targetExam: editExam,
        sscYear: editSsc,
        hscYear: editHsc,
        whatsapp: editWhatsapp,
        bio: editBio,
        photoURL: editPhoto,
        updatedAt: new Date().toISOString()
      });
      setIsEditingProfile(false);
      toast.success("Profile updated successfully!");
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
        toast.success("Device authorized and features unlocked successfully!");
        setAuthCodeInput('');
      } else {
        toast.error("Invalid or expired authorization code.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to activate code.");
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Opening Gift Announcement */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                {language === 'en' ? 'Opening Gift: 7 Days Free Trial!' : 'উদ্বোধনী উপহার: ৭ দিনের ফ্রি ট্রায়াল!'}
              </h2>
              <p className="text-purple-100 text-sm sm:text-base">
                {language === 'en' 
                  ? 'Enjoy full access to all premium features for 7 days. Happy learning!' 
                  : '৭ দিনের জন্য সকল প্রিমিয়াম ফিচারে পূর্ণ অ্যাক্সেস উপভোগ করুন। শুভ অধ্যয়ন!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm text-sm font-bold whitespace-nowrap">
            <Check className="w-4 h-4" />
            {language === 'en' ? 'Active Now' : 'এখনই সক্রিয়'}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex-1 w-full">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {language === 'en' ? `Welcome back, ${user?.displayName?.split(' ')[0]}!` : `স্বাগতম, ${user?.displayName?.split(' ')[0]}!`}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">
            {language === 'en' ? "Here's your preparation overview for today." : "আজকের জন্য আপনার প্রস্তুতির ওভারভিউ।"}
          </p>
          
          {/* Preparation Score Progress Bar */}
          <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm max-w-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {language === 'en' ? 'Preparation Score' : 'প্রস্তুতি স্কোর'}
              </span>
              <span className="text-sm font-bold text-blue-600">
                {userData?.preparationScore || 0}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out"
                style={{ width: `${userData?.preparationScore || 0}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              {language === 'en' 
                ? 'Complete your profile to increase your score!' 
                : 'আপনার স্কোর বাড়াতে প্রোফাইল পূর্ণ করুন!'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleEditClick}
          className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto justify-center"
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
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Exam</label>
                  <input 
                    type="text" 
                    value={editExam} 
                    onChange={(e) => setEditExam(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SSC Year</label>
                  <input 
                    type="text" 
                    value={editSsc} 
                    onChange={(e) => setEditSsc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HSC Year</label>
                  <input 
                    type="text" 
                    value={editHsc} 
                    onChange={(e) => setEditHsc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp Number</label>
                <input 
                  type="text" 
                  value={editWhatsapp} 
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile Photo URL</label>
                <input 
                  type="text" 
                  value={editPhoto} 
                  onChange={(e) => setEditPhoto(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Bio</label>
                <textarea 
                  value={editBio} 
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:text-white resize-none"
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

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 sm:w-64 sm:h-64 bg-blue-400/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">
              {language === 'en' ? 'The Unparalleled Advantage' : 'অপ্রতিদ্বন্দ্বী শ্রেষ্ঠত্ব'}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div className="space-y-4">
              <p className="text-blue-50 text-base sm:text-lg leading-relaxed font-medium">
                {language === 'en' 
                  ? "Unlike traditional question banks, our system leverages cutting-edge AI to transform daily news into exam-ready intelligence. We don't just give you questions; we provide a scientifically-backed memory system using the SM-2 Spaced Repetition algorithm, ensuring you never forget what you learn."
                  : "প্রচলিত প্রশ্নব্যাংকের বিপরীতে, আমাদের সিস্টেম অত্যাধুনিক AI ব্যবহার করে প্রতিদিনের সংবাদকে পরীক্ষার উপযোগী তথ্যে রূপান্তর করে। আমরা কেবল আপনাকে প্রশ্ন দিই না; আমরা SM-2 স্পেসড রিপিটিশন অ্যালগরিদম ব্যবহার করে একটি বৈজ্ঞানিকভাবে স্বীকৃত মেমরি সিস্টেম প্রদান করি, যা নিশ্চিত করে যে আপনি যা শিখছেন তা কখনোই ভুলবেন না।"}
              </p>
              <p className="text-blue-100/80 text-xs sm:text-sm italic">
                {language === 'en'
                  ? "With automated syllabus mapping and real-time current affairs integration, this isn't just a study tool—it's your essential partner in the most competitive exam in Bangladesh."
                  : "স্বয়ংক্রিয় সিলেবাস ম্যাপিং এবং রিয়েল-টাইম কারেন্ট অ্যাফেয়ার্স ইন্টিগ্রেশনের মাধ্যমে, এটি কেবল একটি অধ্যয়নের সরঞ্জাম নয়—এটি বাংলাদেশের সবচেয়ে প্রতিযোগিতামূলক পরীক্ষায় আপনার অপরিহার্য অংশীদার।"}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                <div className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider font-bold mb-1">AI Intelligence</div>
                <div className="text-lg sm:text-xl font-bold">Real-time Analysis</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                <div className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider font-bold mb-1">Retention</div>
                <div className="text-lg sm:text-xl font-bold">SM-2 Algorithm</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                <div className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider font-bold mb-1">Coverage</div>
                <div className="text-lg sm:text-xl font-bold">Syllabus Mapped</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                <div className="text-blue-200 text-[10px] sm:text-xs uppercase tracking-wider font-bold mb-1">Success</div>
                <div className="text-lg sm:text-xl font-bold">Data-Driven</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
            <Flame className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Current Streak</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{userData?.streak || 0} Days</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Target className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Target Exam</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-none">{userData?.targetExam || 'Not Set'}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Questions Solved</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">124</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => window.location.href = '/results'}>
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
            <Award className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
              {latestResult ? `Latest: ${latestResult.score}/${latestResult.totalQuestions}` : 'Past Results'}
            </p>
            <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
              {latestResult ? latestResult.subject : 'View History'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Personalized Study Plan */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personalized Study Plan</h2>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                AI POWERED
              </div>
            </div>
            <div className="p-6">
              {isGeneratingPlan ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <p className="text-gray-500 dark:text-gray-400">Generating your custom plan...</p>
                </div>
              ) : studyPlan.length > 0 ? (
                <div className="space-y-4">
                  {studyPlan.map((item, idx) => (
                    <div key={idx} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                      completedTasks.includes(idx) 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 opacity-75' 
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700'
                    }`}>
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        completedTasks.includes(idx) ? 'bg-green-500' :
                        item.priority === 'High' ? 'bg-red-500' : 
                        item.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <h4 className={`text-sm font-bold transition-all ${
                          completedTasks.includes(idx) ? 'text-green-700 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'
                        }`}>{item.task}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">{item.duration}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            completedTasks.includes(idx) ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                            item.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 
                            item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' : 
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
                          }`}>
                            {completedTasks.includes(idx) ? 'Completed' : `${item.priority} Priority`}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleTask(idx)}
                        className={`p-2 transition-colors ${
                          completedTasks.includes(idx) ? 'text-green-600' : 'text-gray-400 hover:text-green-600'
                        }`}
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No plan generated. Try refreshing.</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today's GK Feed</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Curated current affairs linked to static GK</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading today's GK...</div>
            ) : sortedGK.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">No GK points generated yet. Check the News Pipeline.</div>
            ) : (
              sortedGK.map((gk) => (
                <div key={gk.id} className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isDue(gk.id) ? 'border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                        {gk.subject}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{gk.topic}</span>
                    </div>
                    {isDue(gk.id) && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">Due for Review</span>
                    )}
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium mb-2">{gk.current_affair}</p>
                  <div className="flex items-start space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/50 mb-4">
                    <BookOpen className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200"><span className="font-semibold">Static Link:</span> {gk.static_gk_link}</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm text-gray-500 w-full sm:w-auto mb-1 sm:mb-0">How was your recall?</span>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleRate(gk.id, 'Forgot')} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs sm:text-sm font-medium">Forgot</button>
                      <button onClick={() => handleRate(gk.id, 'Hard')} className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs sm:text-sm font-medium">Hard</button>
                      <button onClick={() => handleRate(gk.id, 'Good')} className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-xs sm:text-sm font-medium">Good</button>
                      <button onClick={() => handleRate(gk.id, 'Easy')} className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs sm:text-sm font-medium">Easy</button>
                    </div>
                  </div>
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
    </div>
  );
}
