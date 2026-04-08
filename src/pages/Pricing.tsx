import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Check, Shield, Zap, Crown } from 'lucide-react';

export default function Pricing() {
  const { userData } = useAuth();
  
  const isTrial = userData?.tier === 'trial';
  const trialEnds = userData?.trialEndsAt ? new Date(userData.trialEndsAt) : null;
  const isTrialExpired = trialEnds ? new Date() > trialEnds : false;

  const tiers = [
    {
      name: 'সূচনা (Basic)',
      price: '৳২৯৯',
      period: '/month',
      icon: <Shield className="w-6 h-6 text-blue-500" />,
      features: [
        'Access to Practice Mode',
        'Daily GK Updates',
        'Basic Analytics',
        'Community Access'
      ],
      color: 'blue'
    },
    {
      name: 'অগ্রগামী (Pro)',
      price: '৳৪৯৯',
      period: '/month',
      icon: <Zap className="w-6 h-6 text-orange-500" />,
      features: [
        'Everything in Basic',
        'Unlimited Mock Exams',
        'Subject-wise Weakness Analysis',
        'Priority Support'
      ],
      color: 'orange',
      popular: true
    },
    {
      name: 'শীর্ষ (Elite)',
      price: '৳৯৯৯',
      period: '/month',
      icon: <Crown className="w-6 h-6 text-purple-500" />,
      features: [
        'Everything in Pro',
        'AI Interview Mode (Unlimited)',
        'Personalized Study Plan',
        '1-on-1 Mentorship Session'
      ],
      color: 'purple'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Upgrade Your Preparation</h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Choose the plan that fits your study needs and unlock exclusive features to accelerate your BCS journey.
        </p>
        
        {isTrial && (
          <div className={`inline-block mt-4 px-4 py-2 rounded-lg text-sm font-medium ${isTrialExpired ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}`}>
            {isTrialExpired 
              ? 'Your 3-month free trial has expired. Please upgrade to continue accessing premium features.'
              : `You are currently on a free trial until ${trialEnds?.toLocaleDateString()}.`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div key={tier.name} className={`relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border-2 ${tier.popular ? 'border-orange-500' : 'border-gray-100 dark:border-gray-700'} flex flex-col`}>
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold tracking-wide">
                MOST POPULAR
              </div>
            )}
            
            <div className="flex items-center space-x-3 mb-6">
              <div className={`p-3 rounded-xl bg-${tier.color}-50 dark:bg-${tier.color}-900/30`}>
                {tier.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
            </div>
            
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">{tier.price}</span>
              <span className="text-gray-500 dark:text-gray-400">{tier.period}</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <Check className={`w-5 h-5 mr-3 flex-shrink-0 text-${tier.color}-500`} />
                  <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-4">
                To upgrade or purchase this tier, please contact the developer:
              </p>
              <a 
                href="mailto:zeroxpanda360@gmail.com"
                className={`block w-full py-3 px-4 rounded-xl text-center font-semibold transition-colors ${
                  tier.popular 
                    ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                    : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white'
                }`}
              >
                Contact zeroxpanda360@gmail.com
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
