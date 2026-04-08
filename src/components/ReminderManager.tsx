import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Plus, Trash2 } from 'lucide-react';

interface Reminder {
  id: string;
  task: string;
  dueAt: string;
  userId: string;
  createdAt: string;
}

export default function ReminderManager() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState('');
  const [dueAt, setDueAt] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchReminders = async () => {
      setLoading(true);
      const q = query(collection(db, 'reminders'), where('userId', '==', user.uid), orderBy('dueAt', 'asc'));
      const snapshot = await getDocs(q);
      setReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
      setLoading(false);
    };
    fetchReminders();
  }, [user]);

  const addReminder = async () => {
    if (!user || !task || !dueAt) return;
    setLoading(true);
    await addDoc(collection(db, 'reminders'), {
      userId: user.uid,
      task,
      dueAt,
      createdAt: new Date().toISOString()
    });
    setTask('');
    setDueAt('');
    // Refresh
    const q = query(collection(db, 'reminders'), where('userId', '==', user.uid), orderBy('dueAt', 'asc'));
    const snapshot = await getDocs(q);
    setReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    setLoading(false);
  };

  const deleteReminder = async (id: string) => {
    setLoading(true);
    await deleteDoc(doc(db, 'reminders', id));
    setReminders(prev => prev.filter(r => r.id !== id));
    setLoading(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Bell className="w-5 h-5 mr-2 text-blue-600" />
        Reminders
      </h2>
      <div className="flex gap-2 mb-4">
        <input type="text" value={task} onChange={e => setTask(e.target.value)} placeholder="Task" className="flex-grow p-2 border rounded-lg dark:bg-gray-700" />
        <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-700" />
        <button onClick={addReminder} disabled={loading} className="p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"><Plus /></button>
      </div>
      <div className="space-y-2">
        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {reminders.map(r => {
          const isOverdue = new Date(r.dueAt) < new Date();
          return (
            <div key={r.id} className={`flex justify-between items-center p-3 rounded-lg ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
              <span className={isOverdue ? 'text-red-700 dark:text-red-300 font-medium' : ''}>
                {r.task} ({new Date(r.dueAt).toLocaleString()}) {isOverdue && <span className="text-xs font-bold uppercase ml-2">Overdue</span>}
              </span>
              <button onClick={() => deleteReminder(r.id)} className="text-red-500"><Trash2 /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
