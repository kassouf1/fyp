import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse } from '../api/auth';
import { registerPushToken } from '../services/notifications';

interface AuthContextValue {
  user: AuthResponse | null;
  isLoading: boolean;
  signIn: (user: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: AuthResponse) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const json = await AsyncStorage.getItem('auth_user');
        if (json) setUser(JSON.parse(json));
      } catch {
        // ignore corrupt storage
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const signIn = async (userData: AuthResponse) => {
    if (!userData?.token) {
      throw new Error('Server returned no token. Please restart the backend and try again.');
    }
    await AsyncStorage.setItem('auth_token', userData.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
    setUser(userData);
    registerPushToken(userData.userId); // fire-and-forget
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
    setUser(null);
  };

  const updateUser = async (userData: AuthResponse) => {
    if (!userData?.token) return;
    await AsyncStorage.setItem('auth_token', userData.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
