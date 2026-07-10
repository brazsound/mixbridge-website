import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Untriaged-item counts for admin notification badges.
 *
 * Backed by the `admin_unread_counts()` Postgres function (SECURITY DEFINER,
 * admin-gated via is_admin()): feedback still marked 'new' plus extension
 * submissions still 'pending'. Counts drop as items are triaged — set a
 * feedback status, approve/reject a submission.
 *
 * Non-admins get zeros from the server, so calling this is always safe;
 * pass `enabled: false` to skip polling entirely.
 */

export interface AdminBadges {
  feedbackNew: number;
  extensionsPending: number;
}

const ZERO: AdminBadges = { feedbackNew: 0, extensionsPending: 0 };

export function useAdminBadges(enabled: boolean, pollMs = 60_000) {
  const [badges, setBadges] = useState<AdminBadges>(ZERO);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase.rpc('admin_unread_counts');
    if (error || !data) return;
    const d = data as { feedback_new?: number; extensions_pending?: number };
    setBadges({
      feedbackNew: d.feedback_new ?? 0,
      extensionsPending: d.extensions_pending ?? 0,
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setBadges(ZERO);
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, pollMs, refresh]);

  return { badges, refresh };
}
