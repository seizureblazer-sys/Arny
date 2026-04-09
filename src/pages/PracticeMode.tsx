import React, { useState, useEffect } from 'react';
import { collection, query, limit, getDocs, where, addDoc, setDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Lock, Flag, Clock, Sparkles, Loader2, Search } from 'lucide-react';
import FeedbackModal from '../components/FeedbackModal';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { toast } from 'react-hot-toast';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation_bn: string;
  rationale?: string;
}

const SUBJECTS = [
  'All Subjects',
  'Bangla Literature',
  'English Literature',
  'Bangladesh Affairs',
  'International Affairs',
  'Mental Ability',
  'Mathematical Reasoning',
  'General Science',
  'Computer & IT',
  'Ethics and Good Governance'
];

export default function PracticeMode() {
  const { user, userData, isDeviceAuthorized } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isTimerEnabled, setIsTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(10); // minutes
  const [timeLeft, setTimeLeft] = useState(0);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user || hasStarted) return;

    const checkSession = async () => {
      const sessionDoc = await getDoc(doc(db, 'active_practice_sessions', user.uid));
      if (sessionDoc.exists()) {
        setActiveSession(sessionDoc.data());
        setShowResumePrompt(true);
      }
    };
    checkSession();
  }, [user, hasStarted]);

  const saveSession = async (
    currentQuestions: any,
    index: number,
    currentScore: number,
    ans: string | null,
    expl: boolean,
    time: number
  ) => {
    if (!user || isFinished) return;
    try {
      await setDoc(doc(db, 'active_practice_sessions', user.uid), {
        userId: user.uid,
        questions: currentQuestions,
        currentIndex: index,
        score: currentScore,
        selectedAnswer: ans,
        showExplanation: expl,
        timeLeft: time,
        selectedSubject,
        isTimerEnabled,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error saving practice session", error);
    }
  };

  const resumeSession = () => {
    if (!activeSession) return;
    setQuestions(activeSession.questions);
    setCurrentIndex(activeSession.currentIndex);
    setScore(activeSession.score);
    setSelectedAnswer(activeSession.selectedAnswer);
    setShowExplanation(activeSession.showExplanation);
    setTimeLeft(activeSession.timeLeft);
    setSelectedSubject(activeSession.selectedSubject);
    setIsTimerEnabled(activeSession.isTimerEnabled);
    setHasStarted(true);
    setShowResumePrompt(false);
  };

  const discardSession = async () => {
    if (user) {
      await deleteDoc(doc(db, 'active_practice_sessions', user.uid));
    }
    setActiveSession(null);
    setShowResumePrompt(false);
  };

  const startPractice = async () => {
    setLoading(true);
    try {
      let q;
      if (selectedSubject === 'All Subjects') {
        q = query(collection(db, 'questions'), limit(50));
      } else {
        q = query(collection(db, 'questions'), where('subject', '==', selectedSubject), limit(50));
      }
      const snapshot = await getDocs(q);
      let qs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Question));
      
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        qs = qs.filter(q => 
          q.question_text.toLowerCase().includes(term) || 
          (q as any).topic?.toLowerCase().includes(term)
        );
      }

      // Limit to 10 for the session
      qs = qs.slice(0, 10);

      if (qs.length === 0) {
        toast.error("No questions found matching your search.");
        setLoading(false);
        return;
      }

      setQuestions(qs);
      setHasStarted(true);
      if (isTimerEnabled) {
        setTimeLeft(timerDuration * 60);
      }
    } catch (error) {
      console.error("Error fetching questions", error);
    } finally {
      setLoading(false);
    }
  };

  const saveResult = async () => {
    if (user && questions.length > 0) {
      await deleteDoc(doc(db, 'active_practice_sessions', user.uid));
      await addDoc(collection(db, 'test_results'), {
        userId: user.uid,
        score: score,
        totalQuestions: questions.length,
        subject: selectedSubject === 'All Subjects' ? 'Mixed Practice' : selectedSubject,
        createdAt: new Date().toISOString()
      });

      // Create notification for the user
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'Practice Session Complete',
        message: `You scored ${score}/${questions.length} in ${selectedSubject}. Great job!`,
        type: 'success',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    let timer: any;
    if (hasStarted && !isFinished && isTimerEnabled && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;
          if (next % 10 === 0) {
            saveSession(questions, currentIndex, score, selectedAnswer, showExplanation, next);
          }
          return next;
        });
      }, 1000);
    } else if (hasStarted && !isFinished && isTimerEnabled && timeLeft === 0) {
      setIsFinished(true);
      saveResult();
    }
    return () => clearInterval(timer);
  }, [hasStarted, isFinished, isTimerEnabled, timeLeft, questions, currentIndex, score, selectedAnswer, showExplanation]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && !isFinished) {
        saveSession(questions, currentIndex, score, selectedAnswer, showExplanation, timeLeft);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasStarted, isFinished, questions, currentIndex, score, selectedAnswer, showExplanation, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswer = async (option: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(option);
    setShowExplanation(true);
    
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.correct_answer;

    let newScore = score;
    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
    }

    // Generate AI explanation if incorrect or if user wants more detail
    if (!isCorrect) {
      generateAiExplanation(currentQ, option);
    }

    saveSession(questions, currentIndex, newScore, option, true, timeLeft);
  };

  const generateAiExplanation = async (question: Question, chosenOption: string) => {
    setIsGeneratingAi(true);
    try {
      const prompt = `
        As an expert BCS (Bangladesh Civil Service) exam tutor, explain why the chosen answer is incorrect and why the correct answer is right.
        
        Question: ${question.question_text}
        Options: ${question.options.join(', ')}
        Chosen Answer: ${chosenOption}
        Correct Answer: ${question.correct_answer}
        ${question.rationale ? `Rationale provided: ${question.rationale}` : ''}
        ${question.explanation_bn ? `Base Explanation: ${question.explanation_bn}` : ''}
        
        Provide a detailed, encouraging explanation in both English and Bengali if possible. Focus on the logic and concepts.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiExplanation(response.text);
    } catch (error) {
      console.error("Error generating AI explanation:", error);
      setAiExplanation("Sorry, I couldn't generate a detailed explanation right now. Please refer to the base explanation below.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAiExplanation(null);
      saveSession(questions, nextIndex, score, null, false, timeLeft);
    } else {
      setIsFinished(true);
      await saveResult();
    }
  };

  const isTrialExpired = userData?.tier === 'trial' && new Date() > new Date(userData?.trialEndsAt);
  const isSubExpired = userData?.tier !== 'trial' && (!userData?.subscriptionEndsAt || new Date() > new Date(userData?.subscriptionEndsAt));
  const isLocked = !isDeviceAuthorized || isTrialExpired || isSubExpired || !(userData?.unlockedFeatures || []).includes('practice');

  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Lock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Feature Locked</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {!isDeviceAuthorized 
            ? "Your account is bound to another device. You cannot access premium features from this device."
            : isTrialExpired 
              ? "Your free trial has expired. Please upgrade your plan to continue using Practice Mode." 
              : "You need an active subscription to access Practice Mode."}
        </p>
        <Link 
          to="/pricing"
          className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          View Pricing Plans
        </Link>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        {showResumePrompt && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-full">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Resume Practice?</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">You have an unfinished {activeSession.selectedSubject} session from {new Date(activeSession.updatedAt).toLocaleString()}.</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={discardSession} className="flex-1 sm:flex-none px-6 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Discard</button>
              <button onClick={resumeSession} className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">Resume</button>
            </div>
          </div>
        )}
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Practice Mode</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Select a subject to focus your practice, or choose "All Subjects" for a mixed session.
          </p>
          
          <div className="max-w-xs mx-auto mb-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Search Topics or Questions</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="e.g. History, Science..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Select Subject</label>
              <select 
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              >
                {SUBJECTS.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Timer</label>
              <input 
                type="checkbox" 
                checked={isTimerEnabled}
                onChange={(e) => setIsTimerEnabled(e.target.checked)}
                className="w-5 h-5 text-blue-600"
              />
            </div>
            {isTimerEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Duration (minutes)</label>
                <input 
                  type="number"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}
          </div>

          <button 
            onClick={startPractice}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Start Practice'}
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">No Questions Available</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">No questions found for the selected subject. Please run the News Pipeline to generate some questions.</p>
        <button 
          onClick={() => setHasStarted(false)}
          className="mt-6 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Practice Complete!</h2>
        <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-6">
          {score} / {questions.length}
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Keep practicing to improve your score.</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Practice Again
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Practice Mode</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
          {isTimerEnabled && (
            <div className={`px-3 py-1.5 rounded-full font-mono font-bold text-sm ${timeLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}`}>
              {formatTime(timeLeft)}
            </div>
          )}
          <button 
            onClick={() => {
              setShowFeedbackModal(true);
            }}
            className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-red-500"
          >
            <Flag className="w-4 h-4" />
            Flag
          </button>
          <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs sm:text-sm font-medium ml-auto sm:ml-0">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-white mb-6 sm:mb-8 leading-relaxed">{currentQ.question_text}</h2>
        
        {showFeedbackModal && (
          <FeedbackModal 
            questionId={currentQ.id} 
            onClose={() => setShowFeedbackModal(false)} 
          />
        )}

        <div className="space-y-3">
          {currentQ.options.map((option, idx) => {
            let btnClass = "w-full text-left px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl border-2 transition-all text-sm sm:text-base ";
            if (!selectedAnswer) {
              btnClass += "border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-white";
            } else if (option === currentQ.correct_answer) {
              btnClass += "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-300";
            } else if (option === selectedAnswer) {
              btnClass += "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300";
            } else {
              btnClass += "border-gray-200 dark:border-gray-700 opacity-50 dark:text-gray-400";
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(option)}
                disabled={!!selectedAnswer}
                className={btnClass}
              >
                {option}
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className="mt-8 space-y-4">
            {isGeneratingAi ? (
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <p className="text-blue-700 dark:text-blue-300 font-medium">AI is generating a detailed explanation...</p>
              </div>
            ) : aiExplanation ? (
              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-indigo-900 dark:text-indigo-300">AI Detailed Analysis:</h3>
                </div>
                <div className="prose prose-indigo dark:prose-invert max-w-none text-indigo-800 dark:text-indigo-200 text-sm sm:text-base leading-relaxed">
                  <Markdown>{aiExplanation}</Markdown>
                </div>
              </div>
            ) : null}

            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Explanation:</h3>
              <p className="text-blue-800 dark:text-blue-200">{currentQ.explanation_bn}</p>
            </div>
            {currentQ.rationale && (
              <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900/50">
                <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Rationale:</h3>
                <p className="text-purple-800 dark:text-purple-200">{(currentQ as any).rationale}</p>
              </div>
            )}
          </div>
        )}

        {selectedAnswer && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNext}
              className="w-full sm:w-auto px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg"
            >
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Practice'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
