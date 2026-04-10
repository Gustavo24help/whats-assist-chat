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
    const isStaleRequest = () => activeUserIdRef.current !== userId || profileRequestRef.current !== requestId;

    try {
      console.log('🔍 AuthContext - Carregando perfil do usuário:', userId);

      // Buscar perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ AuthContext - Erro ao buscar perfil:', profileError);
      }

      // Buscar role - FONTE DE VERDADE usando SDK do Supabase
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      // Tratamento elegante de erro - não quebrar o sistema
      if (roleError) {
        console.error('❌ AuthContext - Erro ao buscar role:', {
          error: roleError,
          code: roleError.code,
          message: roleError.message
        });
        // Usar fallback seguro
        const userProfileData: UserProfile = {
          id: userId,
          email: userEmail || user?.email || '',
          fullName: profile?.full_name || 'Sem nome',
          role: 'user' // Fallback seguro
        };

        if (isStaleRequest()) return null;

        setUserProfile(userProfileData);
        console.log('⚠️ AuthContext - Usando fallback devido a erro');
        return userProfileData;
      }

      console.log('📊 AuthContext - Dados carregados:', {
        userId,
        profileName: profile?.full_name,
        roleRaw: roleData?.role,
        roleType: typeof roleData?.role
      });

      // Normalizar role para lowercase
      const normalizedRole = roleData?.role?.toLowerCase() as 'admin' | 'supervisor' | 'user' | 'chefe' | 'admin_ti';
      const finalRole = normalizedRole === 'admin' ? 'admin' : normalizedRole === 'admin_ti' ? 'admin_ti' : normalizedRole === 'chefe' ? 'chefe' : normalizedRole === 'supervisor' ? 'supervisor' : 'user';

      const userProfileData: UserProfile = {
        id: userId,
        email: userEmail || user?.email || '',
        fullName: profile?.full_name || 'Sem nome',
        role: finalRole
      };

      if (isStaleRequest()) return null;

      setUserProfile(userProfileData);

      console.log('✅ AuthContext - Perfil definido:', {
        userId,
        role: finalRole,
        isAdmin: finalRole === 'admin'
      });

      return userProfileData;
    } catch (error) {
      console.error('❌ AuthContext - Erro ao carregar perfil:', error);
      // Fallback seguro em caso de erro
      const fallbackProfile: UserProfile = {
        id: userId,
        email: userEmail || user?.email || '',
        fullName: 'Sem nome',
        role: 'user'
      };

      if (isStaleRequest()) return null;

      setUserProfile(fallbackProfile);
      return fallbackProfile;
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

    // Escutar mudanças de autenticação ANTES de getSession (evita race condition)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 AuthContext - onAuthStateChange:', event);
        if (event === 'INITIAL_SESSION') {
          // Sessão inicial restaurada do storage
          applySessionUser(session?.user ?? null);
          if (session?.user) queueProfileLoad(session.user);
          initialSessionHandled = true;
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session?.user) {
          applySessionUser(session.user);
          queueProfileLoad(session.user);
          if (!initialSessionHandled) {
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
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
          }, 0);
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

  // Removido console.log que rodava a cada render (impacto de performance)

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
