import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Send, Loader2, Volume2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function InterviewMode() {
  const { userData, isDeviceAuthorized } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize chat session
    const initChat = async () => {
      const chat = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: "You are a senior BPSC (Bangladesh Public Service Commission) board member conducting a Viva (interview). Ask questions one by one. Cover academic background, current affairs, and general knowledge. Be professional, slightly strict, but fair. Evaluate the candidate's answers and provide brief feedback before asking the next question. Start by welcoming the candidate and asking them to introduce themselves.",
          temperature: 0.4,
        }
      });
      setChatSession(chat);
      
      // Get initial greeting
      setIsProcessing(true);
      try {
        const response = await chat.sendMessage({ message: "Start the interview." });
        const text = response.text || '';
        setMessages([{ role: 'model', text }]);
        playTTS(text);
      } catch (error) {
        console.error("Error starting chat", error);
      } finally {
        setIsProcessing(false);
      }
    };
    initChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playTTS = async (text: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }, // Professional sounding voice
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch (error) {
      console.error("TTS Error", error);
    }
  };

  const handleSendText = async (text: string) => {
    if (!text.trim() || !chatSession) return;
    
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await chatSession.sendMessage({ message: text });
      const reply = response.text || '';
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      playTTS(reply);
    } catch (error) {
      console.error("Chat Error", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone", error);
      toast.error("Microphone access is required for the audio feature.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        
        // Transcribe audio using gemini-3-flash-preview
        const transcribeResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: "Transcribe this audio accurately. Only output the transcription, nothing else." },
              { inlineData: { data: base64data, mimeType: 'audio/webm' } }
            ]
          }
        });

        const transcribedText = transcribeResponse.text?.trim() || '';
        if (transcribedText) {
          await handleSendText(transcribedText);
        } else {
          toast.error("Could not transcribe audio. Please try again.");
          setIsProcessing(false);
        }
      };
    } catch (error) {
      console.error("Error processing audio", error);
      setIsProcessing(false);
    }
  };

  const isTrialExpired = userData?.tier === 'trial' && new Date() > new Date(userData?.trialEndsAt);
  const isSubExpired = userData?.tier !== 'trial' && (!userData?.subscriptionEndsAt || new Date() > new Date(userData?.subscriptionEndsAt));
  const isLocked = !isDeviceAuthorized || isTrialExpired || isSubExpired || !(userData?.unlockedFeatures || []).includes('interview');

  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Lock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Feature Locked</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {!isDeviceAuthorized 
            ? "Your account is bound to another device. You cannot access premium features from this device."
            : isTrialExpired 
              ? "Your free trial has expired. Please upgrade your plan to continue using Interview Mode." 
              : "You need an active subscription to access Interview Mode."}
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
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">AI Viva Simulator</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">Practice your interview skills with an AI BPSC Board Member.</p>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-3 sm:p-4 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none shadow-sm'
              }`}>
                <div className={`prose prose-sm sm:prose-base ${msg.role === 'user' || document.documentElement.classList.contains('dark') ? 'prose-invert' : ''} max-w-none`}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tl-none p-3 sm:p-4 flex items-center space-x-2 shadow-sm">
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-gray-500 dark:text-gray-400" />
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-end space-x-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`p-3 sm:p-4 rounded-xl flex-shrink-0 transition-colors ${
                isRecording 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              } disabled:opacity-50`}
            >
              {isRecording ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText(inputText);
                  }
                }}
                placeholder="Type your answer..."
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none dark:text-white text-sm sm:text-base"
                rows={1}
                disabled={isProcessing || isRecording}
              />
              <button
                onClick={() => handleSendText(inputText)}
                disabled={!inputText.trim() || isProcessing || isRecording}
                className="absolute right-1.5 bottom-1.5 p-1.5 sm:p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
          {isRecording && (
            <p className="text-center text-[10px] sm:text-xs text-red-500 dark:text-red-400 mt-2 font-medium animate-pulse">
              Recording... Tap to stop and send.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
