import React, { useState, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, RefreshCw, Link as LinkIcon, CheckCircle, XCircle, Lock, Sparkles } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function NewsPipeline() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newsUrl, setNewsUrl] = useState('');
  const [newsText, setNewsText] = useState('');
  const [numPoints, setNumPoints] = useState(5);
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [streamedText, setStreamedText] = useState('');

  const handleFetchAndProcess = async () => {
    if (!newsUrl.trim() && !newsText.trim()) return;
    setLoading(true);
    setPendingResult(null);
    setStreamedText('');
    setSaveSuccess(false);
    
    try {
      let contentToProcess = newsText;

      if (newsUrl.trim()) {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: newsUrl.trim() })
        });
        
        if (!res.ok) throw new Error('Failed to fetch URL content');
        const data = await res.json();
        contentToProcess = data.text;
        setNewsText(contentToProcess);
      }

      const systemPrompt = `Act as a senior BCS examiner in Bangladesh. Analyze the provided news text.
      You must return a JSON object with the following structure:
      {
        "mapped_subjects": [{"subject": "string", "topic": "string"}],
        "gk_points": [{"current_affair": "string", "static_gk_link": "string"}],
        "questions": [{
          "question_text": "string",
          "options": ["string", "string", "string", "string"],
          "correct_answer": "string",
          "explanation_bn": "string",
          "rationale": "string",
          "difficulty": "Easy" | "Medium" | "Hard"
        }]
      }`;

      const prompt = `Analyze this news article and extract ${numPoints} GK points and 2 MCQs:
      
      News Article:
      ${contentToProcess}`;

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
          // Vercel AI SDK data stream format handling (simplified for this context)
          // The chunks might contain control characters like 0:"...", we need to extract the text
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.substring(2));
                accumulatedText += text;
                setStreamedText(accumulatedText);
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      }

      // Try to parse the final accumulated text as JSON
      try {
        // Find the first { and last } to extract JSON if there's surrounding text
        const startIdx = accumulatedText.indexOf('{');
        const endIdx = accumulatedText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = accumulatedText.substring(startIdx, endIdx + 1);
          const data = JSON.parse(jsonStr);
          setPendingResult(data);
        } else {
          throw new Error("Could not find valid JSON in AI response");
        }
      } catch (e) {
        console.error("JSON Parse Error", e, accumulatedText);
        toast.error("AI response was not in the expected format. Please try again.");
      }

    } catch (error: any) {
      console.error("Error generating content", error);
      toast.error(error.message || "Failed to process.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndSave = async () => {
    if (!pendingResult) return;
    setIsSaving(true);
    
    try {
      const subject = pendingResult.mapped_subjects?.[0]?.subject || 'General Knowledge';
      const topic = pendingResult.mapped_subjects?.[0]?.topic || 'Current Affairs';

      if (pendingResult.gk_points) {
        for (const gk of pendingResult.gk_points) {
          await addDoc(collection(db, 'gk_points'), {
            subject,
            topic,
            current_affair: gk.current_affair,
            static_gk_link: gk.static_gk_link,
            status: 'approved',
            createdAt: new Date().toISOString()
          });
        }
      }

      if (pendingResult.questions) {
        for (const q of pendingResult.questions) {
          await addDoc(collection(db, 'questions'), {
            subject,
            topic,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation_bn: q.explanation_bn,
            rationale: q.rationale,
            difficulty: q.difficulty,
            source_article: newsUrl || 'Pasted Text',
            status: 'approved',
            createdAt: new Date().toISOString()
          });
        }
      }

      setSaveSuccess(true);
      setPendingResult(null);
      setStreamedText('');
      setNewsUrl('');
      setNewsText('');
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving to Firestore", error);
      toast.error("Failed to save to database.");
    } finally {
      setIsSaving(false);
    }
  };

  if (userData?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Automated News Intelligence</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2">Provide a news URL or paste text. The AI will extract GK points and generate MCQs for your approval.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">News URL (Automated Fetch)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LinkIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="url"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white text-sm sm:text-base"
              placeholder="https://www.thedailystar.net/..."
              value={newsUrl}
              onChange={(e) => setNewsUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Number of GK Points</label>
            <input
              type="number"
              min="1"
              max="10"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white text-sm sm:text-base"
              value={numPoints}
              onChange={(e) => setNumPoints(parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-xs sm:text-sm font-medium">OR PASTE TEXT</span>
          <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
        </div>

        <div>
          <textarea
            className="w-full h-32 p-4 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white text-sm sm:text-base resize-none"
            placeholder="Paste article text here if URL fetching fails..."
            value={newsText}
            onChange={(e) => setNewsText(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleFetchAndProcess}
            disabled={loading || (!newsUrl.trim() && !newsText.trim())}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg"
          >
            {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <RefreshCw className="mr-2 h-5 w-5" />}
            {loading ? 'AI is Thinking...' : (newsUrl.trim() ? 'Fetch & Process URL' : 'Process Text')}
          </button>
        </div>
      </div>

      {loading && streamedText && !pendingResult && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900 animate-pulse">
          <div className="flex items-center gap-2 mb-4 text-blue-600">
            <Sparkles className="w-5 h-5 animate-spin" />
            <span className="font-bold">AI is generating content...</span>
          </div>
          <div className="font-mono text-xs text-gray-500 dark:text-gray-400 h-40 overflow-hidden whitespace-pre-wrap">
            {streamedText}
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 p-4 rounded-xl border border-green-200 dark:border-green-800 flex items-start sm:items-center">
          <CheckCircle className="w-5 h-5 mr-2 mt-0.5 sm:mt-0 flex-shrink-0" />
          <p className="text-sm sm:text-base font-medium">Successfully saved to database! The questions are now available in Practice and Exam modes.</p>
        </div>
      )}

      {pendingResult && (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-gray-700 pb-4 gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Review Content</h2>
            <div className="flex w-full sm:w-auto space-x-2 sm:space-x-3">
              <button
                onClick={() => setPendingResult(null)}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg font-medium transition-colors text-sm"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Discard
              </button>
              <button
                onClick={handleApproveAndSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Approve
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Mapped Subjects</h3>
            <div className="flex gap-2 flex-wrap">
              {pendingResult.mapped_subjects?.map((s: any, i: number) => (
                <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-bold">
                  {s.subject}: {s.topic}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Generated GK Points</h3>
            <ul className="space-y-3">
              {pendingResult.gk_points?.map((gk: any, i: number) => (
                <li key={i} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="text-gray-900 dark:text-white font-medium text-sm sm:text-base">{gk.current_affair}</p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2"><span className="font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded mr-1">Static Link:</span> {gk.static_gk_link}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Generated MCQs</h3>
            <div className="space-y-4">
              {pendingResult.questions?.map((q: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="font-bold text-gray-900 dark:text-white mb-3 text-sm sm:text-base">{i + 1}. {q.question_text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {q.options.map((opt: string, j: number) => (
                      <div key={j} className={`p-2.5 rounded border text-sm ${opt === q.correct_answer ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 font-bold' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs sm:text-sm text-blue-900 dark:text-blue-300 mb-2">
                    <span className="font-bold">Explanation:</span> {q.explanation_bn}
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-xs sm:text-sm text-purple-900 dark:text-purple-300 mb-2">
                    <span className="font-bold">Rationale:</span> {q.rationale}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    <span className="font-bold mr-1">Difficulty:</span> 
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      q.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {q.difficulty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
