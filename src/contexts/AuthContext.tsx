import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
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

  const loadUserProfile = async (userId: string) => {
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

      // Buscar role - FONTE DE VERDADE
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('❌ AuthContext - Erro ao buscar role:', roleError);
      }

      console.log('📊 AuthContext - Dados carregados:', {
        userId,
        profileName: profile?.full_name,
        roleRaw: roleData?.role,
        roleType: typeof roleData?.role
      });

      // Normalizar role para lowercase
      const normalizedRole = roleData?.role?.toLowerCase() as 'admin' | 'user';
      const finalRole = normalizedRole === 'admin' ? 'admin' : 'user';

      const userProfileData: UserProfile = {
        id: userId,
        email: user?.email || '',
        fullName: profile?.full_name || 'Sem nome',
        role: finalRole
      };

      setUserProfile(userProfileData);

      console.log('✅ AuthContext - Perfil definido:', {
        userId,
        role: finalRole,
        isAdmin: finalRole === 'admin'
      });

      return userProfileData;
    } catch (error) {
      console.error('❌ AuthContext - Erro ao carregar perfil:', error);
      return null;
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  useEffect(() => {
    console.log('🚀 AuthContext - Inicializando...');

    // Carregar sessão inicial
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ AuthContext - Erro ao carregar sessão:', error);
          setLoading(false);
          return;
        }

        if (session?.user) {
          console.log('✅ AuthContext - Sessão encontrada:', session.user.id);
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else {
          console.log('⚠️ AuthContext - Nenhuma sessão ativa');
        }
      } catch (error) {
        console.error('❌ AuthContext - Erro na inicialização:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthContext - Mudança de auth:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ AuthContext - Usuário logou:', session.user.id);
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 AuthContext - Usuário deslogou');
          setUser(null);
          setUserProfile(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 AuthContext - Token atualizado');
          setUser(session.user);
          // Recarregar perfil para garantir role atualizado
          await loadUserProfile(session.user.id);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin';

  console.log('📌 AuthContext - Estado atual:', {
    hasUser: !!user,
    hasProfile: !!userProfile,
    role: userProfile?.role,
    isAdmin,
    loading
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        loading,
        refreshUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
