import React, { useState, useEffect } from 'react';
import { collection, query, limit, getDocs, addDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, AlertCircle, Lock, Calendar, Flag } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import FeedbackModal from '../components/FeedbackModal';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation_bn: string;
}

interface Exam {
  id: string;
  title: string;
  date: string;
  description?: string;
  subject?: string;
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

export default function ExamMode() {
  const { user, userData, isDeviceAuthorized } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  const selectedSubject = searchParams.get('subject') || 'All Subjects';
  
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes for 10 questions
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [flaggedQuestionId, setFlaggedQuestionId] = useState<string | null>(null);

  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);

  const handleSubjectChange = (subject: string) => {
    setSearchParams({ subject });
  };

  useEffect(() => {
    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        const now = new Date().toISOString();
        let q;
        if (selectedSubject === 'All Subjects') {
          q = query(collection(db, 'exams'), where('date', '>=', now), orderBy('date', 'asc'), limit(10));
        } else {
          q = query(collection(db, 'exams'), where('date', '>=', now), where('subject', '==', selectedSubject), orderBy('date', 'asc'), limit(10));
        }
        const snapshot = await getDocs(q);
        const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Exam));
        setUpcomingExams(examsData);
      } catch (error) {
        console.error("Error fetching exams", error);
      } finally {
        setLoadingExams(false);
      }
    };

    if (!hasStarted) {
      fetchExams();
    }
  }, [selectedSubject, hasStarted]);

  const startExam = async () => {
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
      setTimeLeft(10 * 60);
    } catch (error) {
      console.error("Error fetching questions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (hasStarted && !isFinished && timeLeft > 0 && questions.length > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && !isFinished && questions.length > 0) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [hasStarted, isFinished, timeLeft, questions.length]);

  const handleAnswer = (index: number, option: string) => {
    setAnswers(prev => ({ ...prev, [index]: option }));
  };

  const handleSubmit = async () => {
    setIsFinished(true);
    let currentScore = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) currentScore++;
    });
    setScore(currentScore);

    if (user) {
      await addDoc(collection(db, 'test_results'), {
        userId: user.uid,
        score: currentScore,
        totalQuestions: questions.length,
        subject: selectedSubject === 'All Subjects' ? 'Full Mock Test' : selectedSubject,
        createdAt: new Date().toISOString()
      });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isTrialExpired = userData?.tier === 'trial' && new Date() > new Date(userData?.trialEndsAt);
  const isSubExpired = userData?.tier !== 'trial' && (!userData?.subscriptionEndsAt || new Date() > new Date(userData?.subscriptionEndsAt));
  const isLocked = !isDeviceAuthorized || isTrialExpired || isSubExpired || !(userData?.unlockedFeatures || []).includes('exam');

  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Lock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Feature Locked</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {!isDeviceAuthorized 
            ? "Your account is bound to another device. You cannot access premium features from this device."
            : isTrialExpired 
              ? "Your free trial has expired. Please upgrade your plan to continue using Exam Mode." 
              : "You need an active subscription to access Exam Mode."}
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">BCS Preliminary Mock Test</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            This is a timed test. You have 10 minutes to answer up to 10 questions. 
            Once you start, the timer cannot be paused.
          </p>

          <div className="max-w-xs mx-auto mb-8">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Select Subject</label>
            <select 
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
            >
              {SUBJECTS.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={startExam}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Start Mock Test'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Exams</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedSubject === 'All Subjects' ? 'All upcoming exams' : `Upcoming exams for ${selectedSubject}`}
              </p>
            </div>
            <Calendar className="text-blue-500 w-5 h-5" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {loadingExams ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading exams...</div>
            ) : upcomingExams.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">No upcoming exams scheduled for this subject.</div>
            ) : (
              upcomingExams.map((exam) => (
                <div key={exam.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex justify-between items-center">
                  <div>
                    <h3 className="text-gray-900 dark:text-white font-medium">{exam.title}</h3>
                    {exam.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{exam.description}</p>}
                    {exam.subject && <span className="inline-block mt-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-md">{exam.subject}</span>}
                  </div>
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium border border-blue-100 dark:border-blue-900/50 whitespace-nowrap">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(exam.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))
            )}
          </div>
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Test Complete!</h2>
          <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-6">
            {score} / {questions.length}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Take Another Test
          </button>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Detailed Review</h3>
          {questions.map((q, idx) => {
            const isCorrect = answers[idx] === q.correct_answer;
            const isUnanswered = !answers[idx];
            return (
              <div key={idx} className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border-l-4 ${isCorrect ? 'border-green-500' : isUnanswered ? 'border-yellow-500' : 'border-red-500'}`}>
                <p className="font-medium text-gray-900 dark:text-white mb-4">{idx + 1}. {q.question_text}</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {q.options.map((opt, oIdx) => {
                    let bg = "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300";
                    if (opt === q.correct_answer) bg = "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 font-medium";
                    else if (opt === answers[idx]) bg = "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300";
                    return (
                      <div key={oIdx} className={`p-3 rounded-lg border ${bg}`}>
                        {opt}
                      </div>
                    );
                  })}
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-900 dark:text-blue-300">
                  <span className="font-semibold">Explanation:</span> {q.explanation_bn}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-4 z-10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mock Test</h1>
        <div className="flex items-center space-x-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Answered: {Object.keys(answers).length} / {questions.length}
          </div>
          <div className={`flex items-center px-4 py-2 rounded-lg font-mono font-bold ${timeLeft < 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}`}>
            <Clock className="w-5 h-5 mr-2" />
            {formatTime(timeLeft)}
          </div>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit Test
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            {showFeedbackModal && flaggedQuestionId === q.id && (
              <FeedbackModal 
                questionId={q.id} 
                onClose={() => setShowFeedbackModal(false)} 
              />
            )}
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white"><span className="text-gray-400 dark:text-gray-500 mr-2">{idx + 1}.</span>{q.question_text}</h2>
              <button 
                onClick={() => {
                  setFlaggedQuestionId(q.id);
                  setShowFeedbackModal(true);
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <Flag className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {q.options.map((option, oIdx) => (
                <label 
                  key={oIdx} 
                  className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[idx] === option ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800'}`}
                >
                  <input 
                    type="radio" 
                    name={`question-${idx}`} 
                    value={option}
                    checked={answers[idx] === option}
                    onChange={() => handleAnswer(idx, option)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700 dark:text-gray-300">{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end">
        <button 
          onClick={handleSubmit}
          className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg"
        >
          Finish & Submit Test
        </button>
      </div>
    </div>
  );
}
