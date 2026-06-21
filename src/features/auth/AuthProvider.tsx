import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const prevUid = useRef<string | null | undefined>(undefined);
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    // Apply a session, and if the ACCOUNT actually changed (a different user, or
    // a sign-out) — e.g. another tab in this browser signed into a different
    // account, since Supabase shares one session across tabs — wipe the React
    // Query cache so we never show the previous account's data/balance. A plain
    // token refresh keeps the same uid and is left untouched.
    const apply = (session: Session | null) => {
      if (!active) return;
      const uid = session?.user?.id ?? null;
      if (prevUid.current !== undefined && prevUid.current !== uid) {
        qc.clear();
      }
      prevUid.current = uid;
      setState({ session, user: session?.user ?? null, loading: false });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
