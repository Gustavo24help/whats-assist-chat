import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    console.log('🚫 ProtectedRoute - Usuário não autenticado, redirecionando para /auth');
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isAdmin) {
    console.log('🚫 ProtectedRoute - Acesso negado: usuário não é admin');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
