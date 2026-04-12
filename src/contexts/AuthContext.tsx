import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True when user arrived via an invite link and must set a password before proceeding. */
  needsPasswordSetup: boolean;
  /** True when user arrived via a password reset link — show the reset modal instead of logging in. */
  needsPasswordReset: boolean;
  clearPasswordReset: () => void;
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  updateProfile: (fullName: string) => Promise<{ error?: string }>;
  /** Requires current password when enabled in Supabase (Password security → Require current password when updating). */
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
  /**
   * Set password when the user has none yet (e.g. only ever signed in with magic link).
   * Also valid right after opening a password recovery link (before the session is upgraded).
   */
  setPasswordWithoutCurrent: (newPassword: string) => Promise<{ error?: string }>;
  updateEmail: (newEmail: string) => Promise<{ error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
  updateBetaOptIn: (enabled: boolean) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Keep in sync with Supabase → Authentication → Email → Minimum password length */
const MIN_PASSWORD_LENGTH = 6;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Fetch fresh metadata from the server (getSession returns cached JWT).
      if (session) {
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          if (!mounted || !freshUser) return;
          setUser(freshUser);
          if (freshUser.user_metadata?.needs_password_setup) {
            setNeedsPasswordSetup(true);
          }
        }).catch(() => { /* network error — use cached session */ });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      // Intercept password recovery links — don't treat as a normal login.
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
        return;
      }

      if (session) {
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          if (!mounted || !freshUser) return;
          setUser(freshUser);
          if (freshUser.user_metadata?.needs_password_setup) {
            setNeedsPasswordSetup(true);
          }
        }).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const clearPasswordReset = useCallback(() => setNeedsPasswordReset(false), []);

  const signInWithEmail = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { error: 'Email is required' };

    const redirectTo = `${window.location.origin}/account`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { error: 'Email is required' };
    if (!password) return { error: 'Password is required' };
    const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { error: 'Email is required' };
    if (!password) return { error: 'Password is required' };
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    const redirectTo = `${window.location.origin}/account`;
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: trimmed,
        },
      },
    });
    if (error) return { error: error.message };
    if (!data.session) return { needsEmailConfirmation: true };
    return {};
  }, []);

  const updateProfile = useCallback(async (fullName: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() || undefined },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!currentPassword) return { error: 'Current password is required' };
    if (!newPassword) return { error: 'New password is required' };
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const setPasswordWithoutCurrent = useCallback(async (newPassword: string) => {
    if (!newPassword) return { error: 'Password is required' };
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    // Set password and clear the setup flag in one call
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { needs_password_setup: false },
    });
    if (error) return { error: error.message };
    setNeedsPasswordSetup(false);
    return {};
  }, []);

  const updateEmail = useCallback(async (newEmail: string) => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return { error: 'Email is required' };
    const emailRedirectTo = `${window.location.origin}/account`;
    const { error } = await supabase.auth.updateUser(
      { email: trimmed },
      { emailRedirectTo }
    );
    if (error) return { error: error.message };
    return {};
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { error: 'Email is required' };
    const redirectTo = `${window.location.origin}/account`;
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateBetaOptIn = useCallback(async (enabled: boolean) => {
    const { error } = await supabase.auth.updateUser({ data: { beta_opt_in: enabled } });
    if (error) return { error: error.message };
    return {};
  }, []);

  const deleteAccount = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const token = currentSession?.access_token;
    if (!token) return { error: 'No active session.' };

    const apiUrl = import.meta.env.VITE_LICENSE_API_URL ?? '';
    if (!apiUrl) return { error: 'Account service is not configured.' };

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/web/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) return { error: json.error ?? 'Failed to delete account.' };
      await supabase.auth.signOut();
      return {};
    } catch {
      return { error: 'Could not reach the server. Check your connection.' };
    }
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    needsPasswordSetup,
    needsPasswordReset,
    clearPasswordReset,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    updateProfile,
    updatePassword,
    setPasswordWithoutCurrent,
    updateEmail,
    resetPasswordForEmail,
    updateBetaOptIn,
    deleteAccount,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
