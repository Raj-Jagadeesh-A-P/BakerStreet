import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { api, ApiError } from '../api.js';

const AuthContext = createContext(null);

// Firebase throws Error objects with a machine-readable `.code`
// (e.g. "auth/invalid-credential"). Map the common ones to the same friendly
// messages the old password-based API returned.
export function firebaseErrorMessage(err) {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/user-disabled':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Cannot reach the authentication server. Check your connection.';
    default:
      return err?.message || 'Something went wrong. Please retry.';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const d = await api('/auth/me');
      setUser(d.user);
      setMembership(d.membership);
    } catch {
      setUser(null);
      setMembership(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw new Error(firebaseErrorMessage(err));
    }
    const idToken = await credential.user.getIdToken();
    const d = await api('/auth/login', { method: 'POST', body: { idToken } });
    await refreshMe();
    return d.user;
  }, [refreshMe]);

  const register = useCallback(async (name, email, password, identity) => {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw new Error(firebaseErrorMessage(err));
    }
    try {
      await updateProfile(credential.user, { displayName: name });
    } catch {
      // Non-fatal; the name lives in the Firestore profile.
    }
    const idToken = await credential.user.getIdToken();
    const d = await api('/auth/register', {
      method: 'POST',
      body: { idToken, name, identity },
    });
    await refreshMe();
    return d.user;
  }, [refreshMe]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // Local sign-out failure is non-fatal.
    }
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
    setUser(null);
    setMembership(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, membership, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}