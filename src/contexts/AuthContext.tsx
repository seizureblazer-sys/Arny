import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, collection, addDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  isDeviceAuthorized: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (displayName: string, targetExam: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isDeviceAuthorized: false,
  signInWithGoogle: async () => {},
  logout: async () => {},
  updateUserProfile: async () => {},
});

const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionStartTime = useRef<Date | null>(null);
  const deviceId = getDeviceId();

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        sessionStartTime.current = new Date();
        
        // Ensure user document exists
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const now = new Date();
          const trialEndsAt = new Date(now);
          trialEndsAt.setMonth(now.getMonth() + 3); // 3 months free trial
          
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: now.toISOString(),
            targetExam: '50th BCS',
            streak: 0,
            lastLogin: now.toISOString(),
            tier: 'trial',
            trialEndsAt: trialEndsAt.toISOString(),
            minutesUsed: 0,
            unlockedFeatures: ['practice', 'exam', 'interview']
          }, { merge: true });
        } else {
          await setDoc(userRef, {
            lastLogin: new Date().toISOString(),
          }, { merge: true });
        }

        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        });
      } else {
        setUserData(null);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Track session minutes on unmount or tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && sessionStartTime.current) {
        const endTime = new Date();
        const durationMinutes = Math.round((endTime.getTime() - sessionStartTime.current.getTime()) / 60000);
        
        if (durationMinutes > 0) {
          // Fire and forget session tracking
          addDoc(collection(db, 'sessions'), {
            userId: user.uid,
            startTime: sessionStartTime.current.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes
          }).catch(console.error);
          
          // Update total minutes used
          const userRef = doc(db, 'users', user.uid);
          updateDoc(userRef, {
            minutesUsed: (userData?.minutesUsed || 0) + durationMinutes
          }).catch(console.error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload(); // Also run on unmount
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, userData?.minutesUsed]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const updateUserProfile = async (displayName: string, targetExam: string) => {
    if (!auth.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { displayName });
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { displayName, targetExam });
      setUser({ ...auth.currentUser } as User); // Force re-render with new display name
    } catch (error) {
      console.error("Error updating profile", error);
      throw error;
    }
  };

  const isDeviceAuthorized = !userData?.boundDeviceId || userData.boundDeviceId === deviceId;

  return (
    <AuthContext.Provider value={{ user, userData, loading, isDeviceAuthorized, signInWithGoogle, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
