import React, { useState } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, RefreshCw, Link as LinkIcon, CheckCircle, XCircle, Lock } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });

export default function NewsPipeline() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newsUrl, setNewsUrl] = useState('');
  const [newsText, setNewsText] = useState('');
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFetchAndProcess = async () => {
    if (!newsUrl.trim() && !newsText.trim()) return;
    setLoading(true);
    setPendingResult(null);
    setSaveSuccess(false);
    
    try {
      let contentToProcess = newsText;

      // If URL is provided, fetch it first
      if (newsUrl.trim()) {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: newsUrl.trim() })
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch URL content');
        }
        
        const data = await res.json();
        contentToProcess = data.text;
        setNewsText(contentToProcess); // Show what was fetched
      }

      const prompt = `Act as a senior BCS examiner in Bangladesh. Analyze the provided news text with a Chain-of-Thought approach.

Step 1: Syllabus Mapping
First, analyze which of the following official BCS syllabus subjects this news article maps to. The compulsory subjects are: Bangla Literature, English Literature, Bangladesh Affairs, International Affairs, Mental Ability, Mathematical Reasoning, General Science, Computer & IT, Ethics and Good Governance. For each identified subject, note a specific topic keyword.

Step 2: Extract Exam-Relevant Points
From the article, extract 3-5 key factual points highly relevant to the BCS exam (numbers, dates, names, events).

Step 3: Link to Static GK
For each extracted current affairs point, generate a linked static GK fact.

Step 4: Generate MCQs
Create 2 multiple-choice questions based *only* on the extracted points. For each question, provide 4 plausible options, clearly indicate the correct answer, and write a detailed explanation in **Bengali**.

News Article:
${contentToProcess}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mapped_subjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    topic: { type: Type.STRING }
                  }
                }
              },
              gk_points: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    current_affair: { type: Type.STRING },
                    static_gk_link: { type: Type.STRING }
                  }
                }
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question_text: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correct_answer: { type: Type.STRING },
                    explanation_bn: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setPendingResult(data);

    } catch (error) {
      console.error("Error generating content", error);
      alert("Failed to process. Make sure the URL is accessible or paste text directly.");
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
            source_article: newsUrl || 'Pasted Text',
            createdAt: new Date().toISOString()
          });
        }
      }

      setSaveSuccess(true);
      setPendingResult(null);
      setNewsUrl('');
      setNewsText('');
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving to Firestore", error);
      alert("Failed to save to database.");
    } finally {
      setIsSaving(false);
    }
  };

  if (userData?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Automated News Intelligence</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Provide a news URL or paste text. The AI will extract GK points and generate MCQs for your approval.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">News URL (Automated Fetch)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LinkIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="url"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white"
              placeholder="https://www.thedailystar.net/..."
              value={newsUrl}
              onChange={(e) => setNewsUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-sm">OR PASTE TEXT</span>
          <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
        </div>

        <div>
          <textarea
            className="w-full h-32 p-4 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-white"
            placeholder="Paste article text here if URL fetching fails..."
            value={newsText}
            onChange={(e) => setNewsText(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleFetchAndProcess}
            disabled={loading || (!newsUrl.trim() && !newsText.trim())}
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <RefreshCw className="mr-2 h-5 w-5" />}
            {newsUrl.trim() ? 'Fetch & Process URL' : 'Process Text'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 p-4 rounded-xl border border-green-200 dark:border-green-800 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Successfully saved to database! The questions are now available in Practice and Exam modes.
        </div>
      )}

      {pendingResult && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Generated Content</h2>
            <div className="flex space-x-3">
              <button
                onClick={() => setPendingResult(null)}
                className="flex items-center px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg font-medium transition-colors"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Discard
              </button>
              <button
                onClick={handleApproveAndSave}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Approve & Save
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Mapped Subjects</h3>
            <div className="flex gap-2 flex-wrap">
              {pendingResult.mapped_subjects?.map((s: any, i: number) => (
                <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
                  {s.subject}: {s.topic}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Generated GK Points</h3>
            <ul className="space-y-3">
              {pendingResult.gk_points?.map((gk: any, i: number) => (
                <li key={i} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="text-gray-900 dark:text-white font-medium">{gk.current_affair}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2"><span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">Static Link:</span> {gk.static_gk_link}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Generated MCQs</h3>
            <div className="space-y-4">
              {pendingResult.questions?.map((q: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">{i + 1}. {q.question_text}</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {q.options.map((opt: string, j: number) => (
                      <div key={j} className={`p-2 rounded border ${opt === q.correct_answer ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 font-medium' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-900 dark:text-blue-300">
                    <span className="font-semibold">Explanation:</span> {q.explanation_bn}
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
