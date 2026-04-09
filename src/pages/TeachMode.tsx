import React, { useState } from 'react';
import { Loader2, Search, Lock, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function TeachMode() {
  const { userData, isDeviceAuthorized } = useAuth();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');

  const models = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', icon: '⚡' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', icon: '🧠' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', icon: '🎭' },
  ];

  const handleLearn = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setLesson('');
    try {
      const systemPrompt = `You are an expert BCS (Bangladesh Civil Service) mentor. Create a bite-sized, highly effective micro-lesson.
      Structure the lesson as follows:
      1. **Core Concept**: A simple, 2-sentence explanation of what it is.
      2. **Key Facts to Memorize**: Bullet points of dates, names, or numbers crucial for the BCS preliminary exam.
      3. **Previous Year Context**: Mention if this topic appeared in recent BCS exams.
      4. **Mnemonic / Trick**: Provide a short trick or mnemonic in Bengali or English.
      Keep the tone encouraging and strictly exam-focused. Use markdown formatting.`;

      const prompt = `Create a micro-lesson on the topic: "${topic}"`;

      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemPrompt, modelId: selectedModel })
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
                setLesson(accumulatedText);
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      }
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

      <div className="flex flex-col gap-4">
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

        <div className="flex flex-wrap gap-2 justify-center">
          {models.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                selectedModel === m.id 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-300"
              }`}
            >
              <span>{m.icon}</span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {loading && !lesson && (
        <div className="flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-4">
            <Sparkles className="w-12 h-12 text-blue-500 animate-pulse" />
            <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">AI is crafting your lesson...</p>
          </div>
        </div>
      )}

      {lesson && (
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 prose prose-sm sm:prose-base prose-blue dark:prose-invert max-w-none overflow-hidden">
          <ReactMarkdown>{lesson}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
