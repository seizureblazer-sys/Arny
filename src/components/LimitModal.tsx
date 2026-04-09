import React from 'react';
import { X, Lock, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

interface LimitModalProps {
  onClose: () => void;
  feature: string;
  limit: number | string;
}

export default function LimitModal({ onClose, feature, limit }: LimitModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700"
      >
        <div className="relative h-32 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
            <Lock className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Daily Limit Reached</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You've reached your daily limit of <span className="font-bold text-blue-600 dark:text-blue-400">{limit}</span> {feature}. 
            Upgrade your plan to unlock unlimited access and premium features.
          </p>

          <div className="space-y-3">
            <Link 
              to="/pricing"
              onClick={onClose}
              className="flex items-center justify-center w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none group"
            >
              <Zap className="w-5 h-5 mr-2 fill-current" />
              Upgrade to Pro
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button 
              onClick={onClose}
              className="w-full py-3 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>

        <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-blue-100 dark:bg-blue-900 flex items-center justify-center overflow-hidden">
                <img src={`https://picsum.photos/seed/user${i}/32/32`} alt="user" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            Join 2,000+ students preparing for BCS
          </p>
        </div>
      </motion.div>
    </div>
  );
}
