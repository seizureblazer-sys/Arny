import React, { useState } from 'react';
import { collection, query, limit, getDocs, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Lock, Flag } from 'lucide-react';
import FeedbackModal from '../components/FeedbackModal';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation_bn: string;
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
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const startPractice = async () => {
    setLoading(true);
    try {
      let q;
      if (selectedSubject === 'All Subjects') {
        q = query(collection(db, 'questions'), limit(10));
      } else {
        q = query(collection(db, 'questions'), where('subject', '==', selectedSubject), limit(10));
      }
      const snapshot = await getDocs(q);
      const qs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Question));
      setQuestions(qs);
      setHasStarted(true);
    } catch (error) {
      console.error("Error fetching questions", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(option);
    setShowExplanation(true);
    if (option === questions[currentIndex].correct_answer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsFinished(true);
      // Save result
      if (user) {
        await addDoc(collection(db, 'test_results'), {
          userId: user.uid,
          score: score + (selectedAnswer === questions[currentIndex].correct_answer ? 1 : 0),
          totalQuestions: questions.length,
          subject: selectedSubject === 'All Subjects' ? 'Mixed Practice' : selectedSubject,
          createdAt: new Date().toISOString()
        });
      }
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
      <div className="max-w-2xl mx-auto text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Practice Mode</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Select a subject to focus your practice, or choose "All Subjects" for a mixed session.
        </p>
        
        <div className="max-w-xs mx-auto mb-8">
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

        <button 
          onClick={startPractice}
          disabled={loading}
          className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Start Practice'}
        </button>
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Practice Mode</h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setShowFeedbackModal(true);
            }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500"
          >
            <Flag className="w-4 h-4" />
            Flag Question
          </button>
          <span className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-medium">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-8">{currentQ.question_text}</h2>
        
        {showFeedbackModal && (
          <FeedbackModal 
            questionId={currentQ.id} 
            onClose={() => setShowFeedbackModal(false)} 
          />
        )}

        <div className="space-y-3">
          {currentQ.options.map((option, idx) => {
            let btnClass = "w-full text-left px-6 py-4 rounded-xl border-2 transition-all ";
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
          <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Explanation:</h3>
            <p className="text-blue-800 dark:text-blue-200">{currentQ.explanation_bn}</p>
          </div>
        )}

        {selectedAnswer && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Practice'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
