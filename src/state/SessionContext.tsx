import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import type { GroupGrant } from '../api/access';
import { clearGroupCode, saveCurrentProfileId } from '../api/storage';
import { supabase } from '../api/supabase';
import type { Profile } from '../types';

interface SessionValue {
  grant: GroupGrant | null;
  profile: Profile | null;
  isAdmin: boolean;
  setGrant: (grant: GroupGrant | null) => void;
  setProfile: (profile: Profile) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [grant, setGrant] = useState<GroupGrant | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next);
    void saveCurrentProfileId(next.id);
  }, []);

  const signOut = useCallback(async () => {
    await clearGroupCode();
    await supabase.auth.signOut();
    setGrant(null);
    setProfileState(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      grant,
      profile,
      // O papel de administrador vem do vínculo do dispositivo, atribuído pelo
      // servidor. Nunca de profile.role, que é escolhido no cliente.
      isAdmin: grant?.role === 'admin',
      setGrant,
      setProfile,
      signOut,
    }),
    [grant, profile, setProfile, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession tem de ser usado dentro de SessionProvider');
  }
  return value;
}
