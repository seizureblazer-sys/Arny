import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Search, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function TeachMode() {
  const { userData, isDeviceAuthorized } = useAuth();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState('');

  const handleLearn = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const prompt = `You are an expert BCS (Bangladesh Civil Service) mentor. Create a bite-sized, highly effective micro-lesson on the topic: "${topic}".
      
      Structure the lesson as follows:
      1. **Core Concept**: A simple, 2-sentence explanation of what it is.
      2. **Key Facts to Memorize**: Bullet points of dates, names, or numbers crucial for the BCS preliminary exam.
      3. **Previous Year Context**: Mention if this topic appeared in recent BCS exams (make a highly educated guess if unsure, but keep it realistic).
      4. **Mnemonic / Trick**: Provide a short trick or mnemonic in Bengali or English to remember the key facts.
      
      Keep the tone encouraging and strictly exam-focused. Use markdown formatting.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.3,
          tools: [{ googleSearch: {} }],
        }
      });

      setLesson(response.text || '');
    } catch (error) {
      console.error("Error generating lesson", error);
      setLesson("Failed to generate lesson. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isTrialExpired = userData?.tier === 'trial' && new Date() > new Date(userData?.trialEndsAt);
  const isSubExpired = userData?.tier !== 'trial' && (!userData?.subscriptionEndsAt || new Date() > new Date(userData?.subscriptionEndsAt));
  const isLocked = !isDeviceAuthorized || isTrialExpired || isSubExpired || !(userData?.unlockedFeatures || []).includes('teach');

  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Lock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Feature Locked</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {!isDeviceAuthorized 
            ? "Your account is bound to another device. You cannot access premium features from this device."
            : isTrialExpired 
              ? "Your free trial has expired. Please upgrade your plan to continue using Teach Mode." 
              : "You need an active subscription to access Teach Mode."}
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Teach Mode</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2">Enter any topic from the BCS syllabus to get an AI-generated micro-lesson.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-1.5 sm:p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center flex-1 px-2">
          <Search className="h-5 w-5 text-gray-400 dark:text-gray-500 ml-2" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLearn()}
            placeholder="e.g., The Constitution of Bangladesh..."
            className="flex-1 px-3 py-3 outline-none text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-transparent"
          />
        </div>
        <button
          onClick={handleLearn}
          disabled={loading || !topic.trim()}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Learn Now'}
        </button>
      </div>

      {lesson && (
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 prose prose-sm sm:prose-base prose-blue dark:prose-invert max-w-none overflow-hidden">
          <ReactMarkdown>{lesson}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
