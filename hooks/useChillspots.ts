import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { AccountData, AuthResponse, Preferences, Profile, Spot } from '@/shared/types';
import { api, RequestError, setApiToken } from '@/lib/api';
import { readSession, saveSession } from '@/lib/session';
import { defaultPreferences, readPreferences, writePreferences } from '@/lib/preferences';

export function useChillspots() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshAccount = useCallback(async () => {
    const result = await api<AccountData>('/account');
    setAccount(result); setPreferences(result.profile.preferences); await writePreferences(result.profile.preferences); return result;
  }, []);
  const refreshSpots = useCallback(async () => {
    setError(null); setLoading(true);
    try { const result = await api<{ spots: Spot[] }>('/spots'); setSpots(result.spots); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossibile caricare gli spot.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refreshSpots();
    (async () => {
      try { const saved = await readPreferences(); setPreferences(saved); setApiToken(await readSession()); await refreshAccount(); }
      catch (reason) { if (reason instanceof RequestError && reason.status === 401) { setApiToken(null); await saveSession(null); } }
      finally { setAuthReady(true); }
    })();
  }, [refreshSpots, refreshAccount]);
  async function acceptAuth(result: AuthResponse) {
    if (Platform.OS !== 'web') { await saveSession(result.token); setApiToken(result.token); }
    setAccount(old => ({ profile: result.profile, savedSpotIds: old?.savedSpotIds ?? [], contributions: old?.contributions ?? { spots: [], reviews: [] } }));
    return refreshAccount();
  }
  async function logout() {
    await api('/auth/logout', undefined, 'POST'); setApiToken(null); await saveSession(null); setAccount(null);
  }
  function updateProfile(profile: Profile) { setAccount(old => old ? { ...old, profile } : old); }
  function updateSpot(spot: Spot) { setSpots(old => old.some(item => item.id === spot.id) ? old.map(item => item.id === spot.id ? spot : item) : [spot, ...old]); }
  async function saveSpot(id: string) {
    const saved = account?.savedSpotIds.includes(id);
    const result = await api<{ savedSpotIds: string[] }>(`/saved/${id}`, undefined, saved ? 'DELETE' : 'PUT');
    setAccount(old => old ? { ...old, savedSpotIds: result.savedSpotIds } : old);
    return !saved;
  }
  async function changePreferences(value: Preferences) {
    if (account) { const result = await api<{ profile: Profile }>('/preferences', value, 'PATCH'); updateProfile(result.profile); }
    await writePreferences(value); setPreferences(value);
  }
  return { spots, account, profile: account?.profile ?? null, preferences, loading, authReady, error, setError, refreshAccount, refreshSpots, acceptAuth, logout, updateProfile, updateSpot, saveSpot, changePreferences };
}
