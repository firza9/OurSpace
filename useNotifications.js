import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { isQuietHours } from './v12-utils';

const cloud = import.meta.env.VITE_NOTIFICATION_SYNC_ENABLED === 'true';
const defaults = { appearance: 'light', quiet_enabled: false, quiet_start: '22:00', quiet_end: '07:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };

export default function useNotifications(userId, householdId, events) {
  const scope = userId && householdId ? `ourspace-v12:${userId}:${householdId}` : null;
  const [data, setData] = useState({ scope: null, states: {}, preferences: defaults });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!scope) return;
    let live = true;
    setData({ scope, states: read(`${scope}:states`, {}), preferences: { ...defaults, ...read(`${scope}:preferences`, {}) } });
    const refresh = async () => {
      const [states, prefs] = await Promise.all([
        supabase.from('notification_states').select('event_key,read_at,snoozed_until').eq('user_id', userId).eq('household_id', householdId),
        supabase.from('user_preferences').select('appearance,quiet_enabled,quiet_start,quiet_end,timezone').eq('user_id', userId).maybeSingle(),
      ]);
      if (!live) return;
      if (states.error || prefs.error) { setError('Notification sync unavailable. Check setup or retry. ' + (states.error?.message || prefs.error?.message)); return; }
      setError('');
      setData({ scope, states: Object.fromEntries((states.data || []).map(x => [x.event_key, x])), preferences: { ...defaults, ...prefs.data } });
    };
    let channel;
    if (cloud) {
      refresh();
      channel = supabase.channel(`notification-settings-${userId}-${householdId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_states', filter: `user_id=eq.${userId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` }, refresh).subscribe();
    }
    return () => { live = false; if (channel) supabase.removeChannel(channel); };
  }, [scope, userId, householdId]);
  const states = data.scope === scope ? data.states : {};
  const preferences = data.scope === scope ? data.preferences : defaults;
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.appearance === 'dark' ? 'dark' : 'light';
    return () => { delete document.documentElement.dataset.theme; };
  }, [preferences.appearance]);

  const changeStates = async (keys, patch) => {
    if (!scope || busy) return;
    setBusy(true); setError('');
    const rows = keys.map(key => ({ user_id: userId, household_id: householdId, event_key: key, ...states[key], ...patch }));
    try {
      if (cloud) {
        const { error } = await supabase.from('notification_states').upsert(rows, { onConflict: 'user_id,household_id,event_key' });
        if (error) throw error;
      }
      const next = { ...states, ...Object.fromEntries(rows.map(x => [x.event_key, x])) };
      localStorage.setItem(`${scope}:states`, JSON.stringify(next));
      setData(d => d.scope === scope ? { ...d, states: next } : d);
    } catch (e) { setError('Could not save notification status: ' + e.message); }
    finally { setBusy(false); }
  };
  const savePreferences = async patch => {
    if (!scope || busy) return;
    setBusy(true); setError('');
    const next = { ...preferences, ...patch };
    try {
      if (cloud) {
        const { error } = await supabase.from('user_preferences').upsert({ user_id: userId, ...next });
        if (error) throw error;
      }
      localStorage.setItem(`${scope}:preferences`, JSON.stringify(next));
      setData(d => d.scope === scope ? { ...d, preferences: next } : d);
    } catch (e) { setError('Could not save preferences: ' + e.message); }
    finally { setBusy(false); }
  };
  const items = events.filter(x => x.at <= now).map(x => ({ ...x, ...states[x.key], snoozed: new Date(states[x.key]?.snoozed_until || 0).getTime() > now }));
  return { items, preferences, savePreferences, changeStates, busy, error, cloud,
    unread: items.filter(x => !x.read_at && !x.snoozed), quiet: isQuietHours(preferences, new Date(now)) };
}
