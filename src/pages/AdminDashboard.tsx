import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, Clock, Edit2, Check, X } from 'lucide-react';

interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  tier: string;
  role: string;
  minutesUsed: number;
  trialEndsAt: string;
  subscriptionEndsAt: string;
  unlockedFeatures: string[];
}

export default function AdminDashboard() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserDoc>>({});
  const [searchTerm, setSearchTerm] = useState('');

  if (userData?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDoc));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserDoc) => {
    setEditingUser(user.id);
    setEditForm(user);
  };

  const handleSave = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), editForm);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user", error);
      alert("Failed to update user.");
    }
  };

  const toggleFeature = (feature: string) => {
    const currentFeatures = editForm.unlockedFeatures || [];
    if (currentFeatures.includes(feature)) {
      setEditForm({ ...editForm, unlockedFeatures: currentFeatures.filter(f => f !== feature) });
    } else {
      setEditForm({ ...editForm, unlockedFeatures: [...currentFeatures, feature] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <Shield className="w-8 h-8 mr-3 text-red-500" />
          Admin Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage users, tiers, and feature access.</p>
      </div>

      <input 
        type="text" 
        placeholder="Search by name or email..." 
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700"
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                <th className="p-4 font-medium text-gray-600 dark:text-gray-300">User</th>
                <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Tier</th>
                <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Usage</th>
                <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Access Expiry</th>
                <th className="p-4 font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="p-4 text-center">Loading users...</td></tr>
              ) : filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-4">
                    <div className="font-medium text-gray-900 dark:text-white">{user.displayName || 'Unknown'}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                  </td>
                  
                  {editingUser === user.id ? (
                    <td colSpan={3} className="p-4">
                      <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div>
                          <label className="block text-xs font-medium mb-1">Tier</label>
                          <select 
                            value={editForm.tier || 'trial'} 
                            onChange={e => setEditForm({...editForm, tier: e.target.value})}
                            className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600"
                          >
                            <option value="trial">Trial</option>
                            <option value="suchona">সূচনা (Basic)</option>
                            <option value="ogrogrami">অগ্রগামী (Pro)</option>
                            <option value="shirsho">শীর্ষ (Elite)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Trial Ends At</label>
                          <input 
                            type="datetime-local" 
                            value={editForm.trialEndsAt ? new Date(editForm.trialEndsAt).toISOString().slice(0, 16) : ''}
                            onChange={e => setEditForm({...editForm, trialEndsAt: new Date(e.target.value).toISOString()})}
                            className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Subscription Ends At</label>
                          <input 
                            type="datetime-local" 
                            value={editForm.subscriptionEndsAt ? new Date(editForm.subscriptionEndsAt).toISOString().slice(0, 16) : ''}
                            onChange={e => setEditForm({...editForm, subscriptionEndsAt: new Date(e.target.value).toISOString()})}
                            className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium mb-2">Unlocked Features</label>
                          <div className="flex gap-3">
                            {['practice', 'exam', 'interview', 'pipeline'].map(feature => (
                              <label key={feature} className="flex items-center space-x-2">
                                <input 
                                  type="checkbox" 
                                  checked={(editForm.unlockedFeatures || []).includes(feature)}
                                  onChange={() => toggleFeature(feature)}
                                  className="rounded text-blue-600"
                                />
                                <span className="text-sm capitalize">{feature}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize
                          ${user.tier === 'shirsho' ? 'bg-purple-100 text-purple-800' : 
                            user.tier === 'ogrogrami' ? 'bg-orange-100 text-orange-800' : 
                            user.tier === 'suchona' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {user.tier || 'trial'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Clock className="w-4 h-4 mr-1 text-gray-400" />
                          {user.minutesUsed || 0} mins
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                        {user.tier === 'trial' 
                          ? `Trial: ${new Date(user.trialEndsAt).toLocaleDateString()}`
                          : user.subscriptionEndsAt 
                            ? `Sub: ${new Date(user.subscriptionEndsAt).toLocaleDateString()}`
                            : 'No active sub'}
                      </td>
                    </>
                  )}

                  <td className="p-4">
                    {editingUser === user.id ? (
                      <div className="flex space-x-2">
                        <button onClick={() => handleSave(user.id)} className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Save Directly"><Check className="w-4 h-4" /></button>
                        <button 
                          onClick={async () => {
                            const code = Math.floor(100000 + Math.random() * 900000).toString();
                            const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
                            try {
                              await updateDoc(doc(db, 'users', user.id), {
                                authCode: code,
                                authCodeExpiresAt: expiresAt,
                                pendingTier: editForm.tier || 'trial',
                                pendingSubscriptionEndsAt: editForm.subscriptionEndsAt || null,
                                pendingUnlockedFeatures: editForm.unlockedFeatures || []
                              });
                              alert(`Authorization Code: ${code}\nValid for 5 minutes.`);
                              setEditingUser(null);
                              fetchUsers();
                            } catch (e) {
                              console.error(e);
                              alert("Failed to generate code");
                            }
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                        >
                          Generate Code
                        </button>
                        <button onClick={() => setEditingUser(null)} className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(user)} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
