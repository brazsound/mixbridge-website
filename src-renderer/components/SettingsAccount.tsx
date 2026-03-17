import { useState, useCallback, useEffect } from 'react';
import { useLicense, type Activation } from '../hooks/useLicense';
import { useToast } from '../contexts/ToastContext';
import { ReportBugModal } from './ReportBugModal';

const TIER_LABELS: Record<string, string> = {
  solo: 'Solo (1 device)',
  pro: 'Pro (3 devices)',
  team: 'Team (10 devices)',
};

const TIER_LIMITS: Record<string, number> = {
  solo: 1,
  pro: 3,
  team: 10,
};

interface SettingsAccountProps {
  onRestartTutorial?: () => void;
}

export function SettingsAccount({ onRestartTutorial }: SettingsAccountProps) {
  const { showToast } = useToast();
  const {
    hasAccess,
    status,
    tier,
    userName,
    activationUsed,
    activationLimit,
    loading,
    error,
    refresh,
    activateWithEmail,
    openCheckout,
    deactivate,
    deactivateDevice,
    listActivations,
    setUserName,
    clear,
  } = useLicense();

  const [email, setEmail] = useState('');
  const [nameInput, setNameInput] = useState(userName ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [activationsLoading, setActivationsLoading] = useState(false);
  const [deactivatingDevice, setDeactivatingDevice] = useState<string | null>(null);
  const [reportBugOpen, setReportBugOpen] = useState(false);

  const handleActivate = useCallback(async () => {
    if (!email.trim()) return;
    setActivating(true);
    setActivateError(null);
    const result = await activateWithEmail(email);
    setActivating(false);
    if (result.ok) {
      setEmail('');
    } else {
      setActivateError(result.error ?? 'Activation failed');
    }
  }, [email, activateWithEmail]);

  const handleStartTrial = useCallback(async () => {
    const result = await openCheckout();
    if (result.error) {
      setActivateError(result.error);
    } else {
      void refresh();
    }
  }, [openCheckout, refresh]);

  useEffect(() => {
    setNameInput(userName ?? '');
  }, [userName]);

  const loadActivations = useCallback(async () => {
    if (!hasAccess) return;
    setActivationsLoading(true);
    const list = await listActivations();
    setActivations(list);
    setActivationsLoading(false);
  }, [hasAccess, listActivations]);

  useEffect(() => {
    if (hasAccess) void loadActivations();
  }, [hasAccess, loadActivations]);

  const handleDeactivateOther = useCallback(async (deviceId: string) => {
    const activation = activations.find((a) => a.device_id === deviceId);
    const label = activation?.display_name || activation?.device_id?.slice(0, 8) || 'device';
    if (!window.confirm(`Deactivate "${label}"? That device will be logged out immediately and a slot will be freed.`)) return;
    setDeactivatingDevice(deviceId);
    setDeactivateError(null);
    const result = await deactivateDevice(deviceId);
    setDeactivatingDevice(null);
    if (result.error) setDeactivateError(result.error);
    else void loadActivations();
  }, [activations, deactivateDevice, loadActivations]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    setNameError(null);
    const result = await setUserName(trimmed);
    if (result.error) {
      setNameError(result.error);
    } else {
      setIsEditingName(false);
    }
  }, [nameInput, setUserName]);

  const handleDeactivate = useCallback(async () => {
    if (
      !window.confirm(
        'Deactivate this device? You will need to activate again to use Mix Bridge on this machine. A device slot will be freed for another machine.'
      )
    ) {
      return;
    }
    setDeactivating(true);
    setDeactivateError(null);
    const result = await deactivate();
    setDeactivating(false);
    if (result.error) setDeactivateError(result.error);
  }, [deactivate]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          Account & activation
        </h2>
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Checking license...</span>
        </div>
      </div>
    );
  }

  if (hasAccess) {
    const statusLabel =
      status === 'free'
        ? 'NFR'
        : status === 'trialing'
          ? 'Trial'
          : status === 'active'
            ? 'Active'
            : status === 'past_due'
              ? 'Past due'
              : 'Licensed';

    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          Account & activation
        </h2>
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }} title="Name this device (e.g. Studio A, Home Laptop). Each activation can have its own name.">
              Name
            </span>
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 min-w-0 px-2 py-1 rounded text-sm"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    background: 'var(--surface)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName();
                    if (e.key === 'Escape') {
                      setNameInput(userName ?? '');
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleSaveName()}
                  className="text-xs px-2 py-1 rounded font-medium shrink-0"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(userName ?? '');
                    setIsEditingName(false);
                    setNameError(null);
                  }}
                  className="text-xs px-2 py-1 shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="text-sm text-left min-w-0 truncate hover:underline"
                style={{ color: userName ? 'var(--text)' : 'var(--text-muted)' }}
              >
                {userName || 'Add your name'}
              </button>
            )}
            {nameError && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {nameError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Status
            </span>
            <span
              className="text-sm font-medium px-2 py-1 rounded"
              style={{
                color: status === 'free' ? 'var(--accent)' : 'var(--text)',
                background: 'rgba(255,255,255,0.06)',
              }}
            >
              {statusLabel}
            </span>
          </div>
          {tier && status !== 'free' && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Plan
              </span>
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                {TIER_LABELS[tier] ?? tier}
              </span>
            </div>
          )}
          {((status !== 'free' && tier) || status === 'free') && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Devices
              </span>
              <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
                {activationUsed != null && activationLimit != null
                  ? `${activationUsed} of ${activationLimit} used`
                  : `— of ${activationLimit ?? (status === 'free' ? 3 : TIER_LIMITS[tier ?? ''] ?? '?')} used`}
                <button
                  type="button"
                  onClick={async () => {
                    await refresh(true);
                    void loadActivations();
                  }}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Refresh
                </button>
              </span>
            </div>
          )}

          {/* Activations list */}
          {activations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Manage devices
              </span>
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                {activationsLoading ? (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
                ) : (
                  activations.map((a) => (
                    <div
                      key={a.device_id}
                      className="flex items-center justify-between gap-2 py-1.5 px-2 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      <span className="text-sm truncate min-w-0" style={{ color: 'var(--text)' }}>
                        {a.display_name || a.device_id.slice(0, 12) + '…'}
                        {a.is_current && (
                          <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                            (this device)
                          </span>
                        )}
                      </span>
                      {!a.is_current && (
                        <button
                          type="button"
                          onClick={() => void handleDeactivateOther(a.device_id)}
                          disabled={deactivatingDevice === a.device_id}
                          className="text-xs px-2 py-1 rounded shrink-0 disabled:opacity-50"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        >
                          {deactivatingDevice === a.device_id ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="text-xs self-start text-left hover:underline disabled:opacity-50"
                style={{ color: 'var(--text-muted)' }}
              >
                {deactivating ? 'Deactivating...' : 'Deactivate this device (free a slot)'}
              </button>
            <button
              type="button"
              onClick={clear}
              className="text-xs self-start text-left hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>

          <div
            className="pt-3 mt-3 flex flex-wrap gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            {onRestartTutorial && (
              <button
                type="button"
                onClick={onRestartTutorial}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Restart tutorial
              </button>
            )}
            <button
              type="button"
              onClick={() => setReportBugOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{
                background: 'var(--accent)',
                color: 'white',
              }}
            >
              Report bug
            </button>
            <button
              type="button"
              onClick={async () => {
                const result = await window.appLog?.export();
                if (result?.filePath) {
                  showToast('Log saved. Attach when contacting support.');
                } else if (result?.error && result.error !== 'canceled') {
                  showToast(`Export failed: ${result.error}`, 'error');
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Export support log
            </button>
          </div>
          <ReportBugModal
            open={reportBugOpen}
            onClose={() => setReportBugOpen(false)}
            onSubmit={async (desc) => (await window.appLog?.submitReport(desc)) ?? { ok: false, error: 'Not available' }}
            onSuccess={() => showToast('Report sent. Thanks for helping us improve!')}
            onError={(msg) => showToast(msg, 'error')}
          />
          {deactivateError && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {deactivateError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        Account & activation
      </h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Start a 7-day free trial or subscribe to use Mix Bridge.
      </p>

      <div
        className="rounded-xl p-6 flex flex-col gap-4"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={handleStartTrial}
          className="w-full py-3 px-4 rounded-lg font-medium transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'white',
          }}
        >
          Start 7-day free trial
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            Already have a subscription?
          </span>
          <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
        </div>

        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          />
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating || !email.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {activating ? 'Activating...' : 'Activate'}
          </button>
        </div>

        {(activateError || error) && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {activateError ?? error}
          </p>
        )}

        <div
          className="pt-3 mt-3 flex flex-wrap gap-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setReportBugOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              background: 'var(--accent)',
              color: 'white',
            }}
          >
            Report bug
          </button>
          <button
            type="button"
            onClick={async () => {
              const result = await window.appLog?.export();
              if (result?.filePath) {
                showToast('Log saved. Attach when contacting support.');
              } else if (result?.error && result.error !== 'canceled') {
                showToast(`Export failed: ${result.error}`, 'error');
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            Export support log
          </button>
        </div>
        <ReportBugModal
          open={reportBugOpen}
          onClose={() => setReportBugOpen(false)}
          onSubmit={async (desc) => (await window.appLog?.submitReport(desc)) ?? { ok: false, error: 'Not available' }}
          onSuccess={() => showToast('Report sent. Thanks for helping us improve!')}
          onError={(msg) => showToast(msg, 'error')}
        />
      </div>
    </div>
  );
}
