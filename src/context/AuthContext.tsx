import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getUserProfile } from '../services/auth';
import type { Profile } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  authError: boolean;
  retryAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => { },
  refreshProfile: async () => { },
  authError: false,
  retryAuth: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const initializationStarted = useRef(false);
  const profileRef = useRef<Profile | null>(null);
  const activeFetchPromiseRef = useRef<Promise<Profile | null> | null>(null);
  const currentRequestId = useRef(0);
  const loadingRequestIdRef = useRef<number>(0);
  const loadingStartTimeRef = useRef<number | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setLoadingWithTracking = (val: boolean) => {
    if (val) {
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now();
      }
    } else {
      loadingStartTimeRef.current = null;
    }
    setLoading(val);
  };

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = useCallback(async (
    userId: string, 
    email: string, 
    fullName?: string, 
    isRetry = false, 
    force = false,
    requestId = currentRequestId.current
  ): Promise<Profile | null> => {
    // If not forced and the profile is already cached in context for this user, return it directly
    if (!force && profileRef.current && profileRef.current.id === userId) {
      return profileRef.current;
    }

    // If a request is already in progress, reuse the existing promise to prevent duplicate queries
    if (activeFetchPromiseRef.current) {
      try {
        const profileData = await activeFetchPromiseRef.current;
        if (requestId === currentRequestId.current && profileData) {
          setProfile(profileData);
        }
        return profileData;
      } catch (err) {
        return null;
      }
    }

    // Create the storable promise that fetches the profile
    const fetchPromise = (async (): Promise<Profile | null> => {
      try {
        const userProfile = await getUserProfile(userId);

        if (userProfile) {
          return userProfile;
        } else {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: email,
                full_name: fullName || null,
              })
              .select('id, email, is_admin, full_name')
              .single();

            if (!error && data) {
              return data as Profile;
            } else {
              return null;
            }
          } catch (e) {
            return null;
          }
        }
      } catch (err: any) {
        if (!isRetry) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Clear active ref so the retry creates a fresh fetch sequence
          activeFetchPromiseRef.current = null;
          return await fetchProfile(userId, email, fullName, true, force, requestId);
        }
        throw err;
      }
    })();

    activeFetchPromiseRef.current = fetchPromise;

    try {
      const resolvedProfile = await fetchPromise;
      if (requestId === currentRequestId.current) {
        if (resolvedProfile) {
          setProfile(resolvedProfile);
        } else if (!profileRef.current) {
          setProfile(null);
        }
      }
      return resolvedProfile;
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      if (requestId === currentRequestId.current && !profileRef.current) {
        setProfile(null);
      }
      return null;
    } finally {
      // Clear active request promise reference
      activeFetchPromiseRef.current = null;
    }
  }, []);

  const setupAuth = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoadingWithTracking(false);
      return;
    }
    
    const requestId = ++currentRequestId.current;
    loadingRequestIdRef.current = requestId;
    setLoadingWithTracking(true);
    setAuthError(false);
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (requestId !== currentRequestId.current) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer profile query to let GoTrue client finish initialization and release any internal locks
        setTimeout(async () => {
          try {
            await fetchProfile(
              session.user.id,
              session.user.email || '',
              session.user.user_metadata?.full_name,
              false,
              false,
              requestId
            );
          } catch (err) {
            // Silently ignore or handle failure
          } finally {
            if (loadingRequestIdRef.current <= requestId) {
              setLoadingWithTracking(false);
            }
          }
        }, 0);
      } else {
        setProfile(null);
        if (loadingRequestIdRef.current <= requestId) {
          setLoadingWithTracking(false);
        }
      }
    } catch (err) {
      if (requestId === currentRequestId.current) {
        setAuthError(true);
      }
    } finally {
      if (loadingRequestIdRef.current <= requestId) {
        setLoadingWithTracking(false);
      }
    }
  }, [fetchProfile]);

  const retryAuth = useCallback(async () => {
    if (activeFetchPromiseRef.current) {
      return;
    }
    initializationStarted.current = false;
    await setupAuth();
  }, [setupAuth]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoadingWithTracking(false);
      return;
    }

    let mounted = true;

    if (initializationStarted.current) return;
    initializationStarted.current = true;

    setupAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // Handle INITIAL_SESSION event when no user is logged in
      if (event === 'INITIAL_SESSION' && !newSession) {
        setLoadingWithTracking(false);
        return;
      }

      // Ignore INITIAL_SESSION if setupAuth is already fetching the profile to prevent double fetches
      if (event === 'INITIAL_SESSION') {
        return;
      }

      const currentUser = userRef.current;
      const newUser = newSession?.user ?? null;
      const isUserChanging = currentUser?.id !== newUser?.id;

      const requestId = ++currentRequestId.current;
      
      if (isUserChanging) {
        loadingRequestIdRef.current = requestId;
        setLoadingWithTracking(true);
      }

      // Defer state update and profile query to ensure GoTrue transition is completed
      setTimeout(async () => {
        try {
          if (requestId !== currentRequestId.current) return;

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            await fetchProfile(
              newSession.user.id,
              newSession.user.email || '',
              newSession.user.user_metadata?.full_name,
              false,
              false,
              requestId
            );
          } else {
            setProfile(null);
          }
        } catch (err) {
          // Silently handle
        } finally {
          if (isUserChanging && loadingRequestIdRef.current <= requestId) {
            setLoadingWithTracking(false);
          }
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      initializationStarted.current = false;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      // Instantly clear frontend state for immediate UX
      const requestId = ++currentRequestId.current;
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoadingWithTracking(false);

      try {
        await supabase.auth.signOut();
      } catch (err) {
        // Silently handle
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.email || '', undefined, false, true);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const handleFocus = async () => {
      const isStaleLoading = loading && loadingStartTimeRef.current && (Date.now() - loadingStartTimeRef.current > 8000);
      if (isStaleLoading) {
        setLoadingWithTracking(false);
      }

      if (document.visibilityState === 'visible') {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user) {
            // Only fetch profile if the authenticated user has changed or doesn't have a loaded profile
            const isUserSame = profileRef.current && profileRef.current.id === currentSession.user.id;
            if (!isUserSame) {
              const requestId = ++currentRequestId.current;
              await fetchProfile(
                currentSession.user.id, 
                currentSession.user.email || '', 
                currentSession.user.user_metadata?.full_name, 
                false, 
                false, 
                requestId
              );
            }
          } else if (!currentSession) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        } catch (err) {
          // Silently handle recovery errors
        } finally {
          if (isStaleLoading) {
            setLoadingWithTracking(false);
          }
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [loading, fetchProfile]);

  const isAdmin = !!profile?.is_admin;

  const contextValue = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isAdmin,
    signOut: handleSignOut,
    refreshProfile,
    authError,
    retryAuth
  }), [
    session,
    user,
    profile,
    loading,
    isAdmin,
    handleSignOut,
    refreshProfile,
    authError,
    retryAuth
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

