import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackModalProps {
  questionId: string;
  onClose: () => void;
}

export default function FeedbackModal({ questionId, onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [feedbackType, setFeedbackType] = useState<'incorrect' | 'poorly_formulated'>('incorrect');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'question_feedback'), {
        userId: user.uid,
        questionId,
        feedbackType,
        comment,
        createdAt: new Date().toISOString()
      });
      toast.success("Feedback submitted. AI will re-evaluate.");
      onClose();
      // Trigger AI re-evaluation logic here if needed
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Flag Question</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Type</label>
            <select 
              value={feedbackType} 
              onChange={e => setFeedbackType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="incorrect">Incorrect Answer/Question</option>
              <option value="poorly_formulated">Poorly Formulated</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comment</label>
            <textarea 
              value={comment} 
              onChange={e => setComment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
          <button 
            onClick={handleSubmit}
            disabled={loading || !comment.trim()}
            className="flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
