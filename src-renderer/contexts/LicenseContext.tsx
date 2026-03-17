import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';

export interface LicenseState {
  hasAccess: boolean;
  status: 'trialing' | 'active' | 'past_due' | 'free' | 'expired' | null;
  tier: 'solo' | 'pro' | 'team' | null;
  userName: string | null;
  activationUsed: number | null;
  activationLimit: number | null;
  loading: boolean;
  error: string | null;
}

export interface Activation {
  device_id: string;
  display_name: string | null;
  activated_at: string;
  is_current: boolean;
}

interface LicenseContextValue extends LicenseState {
  refresh: (force?: boolean) => Promise<void>;
  activateWithEmail: (email: string) => Promise<{ ok?: boolean; error?: string }>;
  openCheckout: () => Promise<{ error?: string }>;
  deactivate: () => Promise<{ ok?: boolean; error?: string }>;
  deactivateDevice: (deviceId: string) => Promise<{ ok?: boolean; error?: string }>;
  listActivations: () => Promise<Activation[]>;
  setUserName: (name: string) => Promise<{ ok?: boolean; error?: string }>;
  clear: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LicenseState>({
    hasAccess: false,
    status: null,
    tier: null,
    userName: null,
    activationUsed: null,
    activationLimit: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async (force?: boolean, silent?: boolean) => {
    if (!window.license) {
      setState({ hasAccess: false, status: null, tier: null, userName: null, activationUsed: null, activationLimit: null, loading: false, error: 'License not available' });
      return;
    }
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await window.license.validate(force);
      setState({
        hasAccess: result.hasAccess,
        status: result.status as LicenseState['status'],
        tier: (result.tier as LicenseState['tier']) ?? null,
        userName: result.userName ?? null,
        activationUsed: result.activationUsed ?? null,
        activationLimit: result.activationLimit ?? null,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState({
        hasAccess: false,
        status: null,
        tier: null,
        userName: null,
        activationUsed: null,
        activationLimit: null,
        loading: false,
        error: (e as Error).message,
      });
    }
  }, []);

  const setUserName = useCallback(async (name: string) => {
    if (!window.license?.setUserName) return { error: 'License not available' };
    const result = await window.license.setUserName(name);
    await refresh();
    if (!result.ok) return { error: result.error ?? 'Failed to save name' };
    return { ok: true };
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activateWithEmail = useCallback(async (email: string) => {
    if (!window.license) return { error: 'License not available' };
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await window.license.activateWithEmail(email);
      if (result.ok) {
        await refresh();
        return { ok: true };
      }
      setState((s) => ({ ...s, loading: false }));
      return { error: result.error ?? 'Activation failed' };
    } catch (e) {
      setState((s) => ({ ...s, loading: false }));
      return { error: (e as Error).message };
    }
  }, [refresh]);

  const openCheckout = useCallback(async () => {
    if (!window.license) return { error: 'License not available' };
    return window.license.openCheckout();
  }, []);

  const clear = useCallback(async () => {
    if (!window.license) return;
    await window.license.clear();
    await refresh();
  }, [refresh]);

  const deactivate = useCallback(async () => {
    if (!window.license) return { error: 'License not available' };
    const result = await window.license.deactivate();
    if (result.ok) await refresh();
    return result;
  }, [refresh]);

  const deactivateDevice = useCallback(async (deviceId: string) => {
    if (!window.license?.deactivateDevice) return { error: 'License not available' };
    const result = await window.license.deactivateDevice(deviceId);
    if (result.ok) await refresh();
    return result;
  }, [refresh]);

  const listActivations = useCallback(async (): Promise<Activation[]> => {
    if (!window.license?.listActivations) return [];
    const { activations } = await window.license.listActivations();
    return activations ?? [];
  }, []);

  // Background validation: when user has access, poll every 60s to detect remote deactivation
  useEffect(() => {
    if (!state.hasAccess || state.loading) return;
    const interval = setInterval(() => {
      void refresh(true, true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [state.hasAccess, state.loading, refresh]);

  const value: LicenseContextValue = {
    ...state,
    refresh,
    activateWithEmail,
    openCheckout,
    deactivate,
    deactivateDevice,
    listActivations,
    setUserName,
    clear,
  };

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}
