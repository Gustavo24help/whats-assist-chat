import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'supervisor' | 'user' | 'chefe' | 'admin_ti';
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isAdminTI: boolean;
  isChefe: boolean;
  isSupervisor: boolean;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNED_OUT_GRACE_MS = 3000;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const activeUserIdRef = useRef<string | null>(null);
  const profileRequestRef = useRef(0);
  const lastSignedInAtRef = useRef(0);
  const initialSessionDoneRef = useRef(false);

  const applySessionUser = (sessionUser: User | null) => {
    activeUserIdRef.current = sessionUser?.id ?? null;
    setUser(sessionUser);

    if (!sessionUser) {
      profileRequestRef.current += 1;
      setUserProfile(null);
    }
  };

  const loadUserProfile = async (userId: string, userEmail?: string) => {
    const requestId = ++profileRequestRef.current;
    const isStaleRequest = () =>
      activeUserIdRef.current !== userId || profileRequestRef.current !== requestId;

    const validRoles: UserProfile['role'][] = ['admin', 'supervisor', 'chefe', 'admin_ti', 'user'];

    const buildProfile = (fullName: string, role: UserProfile['role']): UserProfile => ({
      id: userId,
      email: userEmail || '',
      fullName,
      role,
    });

    const fetchRole = async (): Promise<UserProfile['role']> => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data?.role) {
          const normalized = data.role.toLowerCase() as UserProfile['role'];
          return validRoles.includes(normalized) ? normalized : 'user';
        }

        console.log(`⏳ AuthContext - Tentativa ${attempt}/3 para role do user ${userId}`, { error: error?.message, data });

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 300));
          if (isStaleRequest()) return 'user';
        }
      }
      console.warn('⚠️ AuthContext - Todas as tentativas de buscar role falharam, usando fallback');
      return 'user';
    };

    try {
      console.log('🔍 AuthContext - Carregando perfil do usuário:', userId);

      const [profileResult, role] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        fetchRole(),
      ]);

      if (isStaleRequest()) return null;

      const profileData = buildProfile(profileResult.data?.full_name || 'Sem nome', role);
      setUserProfile(profileData);

      console.log('✅ AuthContext - Perfil definido:', {
        userId,
        role,
        isAdmin: role === 'admin',
      });

      return profileData;
    } catch (error) {
      console.error('❌ AuthContext - Erro ao carregar perfil:', error);
      if (isStaleRequest()) return null;
      const fallback = buildProfile('Sem nome', 'user');
      setUserProfile(fallback);
      return fallback;
    }
  };

  const queueProfileLoad = (sessionUser: User) => {
    setTimeout(() => {
      if (activeUserIdRef.current === sessionUser.id) {
        void loadUserProfile(sessionUser.id, sessionUser.email || '');
      }
    }, 0);
  };

  const refreshUserProfile = async () => {
    if (user) {
      await loadUserProfile(user.id, user.email || '');
    }
  };

  useEffect(() => {
    // Timeout de segurança: se não carregar em 10s, liberar a tela
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('⚠️ AuthContext - Timeout de segurança atingido, liberando tela');
          return false;
        }
        return prev;
      });
    }, 10000);

    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 AuthContext - onAuthStateChange:', event);

        if (event === 'INITIAL_SESSION') {
          applySessionUser(session?.user ?? null);
          if (session?.user) queueProfileLoad(session.user);
          initialSessionHandled = true;
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session?.user) {
          lastSignedInAtRef.current = Date.now();
          applySessionUser(session.user);
          queueProfileLoad(session.user);
          if (!initialSessionHandled) {
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          // Grace period: ignorar SIGNED_OUT espúrio logo após login
          const timeSinceSignIn = Date.now() - lastSignedInAtRef.current;
          if (lastSignedInAtRef.current > 0 && timeSinceSignIn < SIGNED_OUT_GRACE_MS) {
            console.warn('⚠️ AuthContext - SIGNED_OUT ignorado (grace period, ' + timeSinceSignIn + 'ms após login)');
            return;
          }

          // Aguardar 500ms e confirmar com getSession antes de aceitar logout
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
              if (error) {
                console.error('❌ AuthContext - Erro ao reconciliar SIGNED_OUT:', error);
              }

              if (currentSession?.user) {
                console.warn('⚠️ AuthContext - SIGNED_OUT transitório detectado, restaurando sessão');
                applySessionUser(currentSession.user);
                queueProfileLoad(currentSession.user);
              } else {
                applySessionUser(null);
              }

              setLoading(false);
            });
          }, 500);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          applySessionUser(session.user);
        }
      }
    );

    // getSession como fallback caso INITIAL_SESSION não dispare
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ AuthContext - Erro ao carregar sessão:', error);
      }
      if (!initialSessionHandled) {
        applySessionUser(session?.user ?? null);
        if (session?.user) {
          void loadUserProfile(session.user.id, session.user.email || '');
        }
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'chefe' || userProfile?.role === 'admin_ti';
  const isAdminTI = userProfile?.role === 'admin_ti';
  const isChefe = userProfile?.role === 'chefe';
  const isSupervisor = userProfile?.role === 'supervisor' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        isAdminTI,
        isChefe,
        isSupervisor,
        loading,
        refreshUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
