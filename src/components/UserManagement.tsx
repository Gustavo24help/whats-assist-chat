import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Trash2, KeyRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'supervisor' | 'user';
}

export const UserManagement = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, refreshUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  
  // Form states
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'supervisor' | 'user'>('user');

  useEffect(() => {
    if (isAdmin && !loading) {
      fetchUsers();
    }
  }, [isAdmin, loading]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (error) throw error;
      if (data?.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error('Erro ao carregar usuários');
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserName,
          role: newUserRole
        }
      });

      if (error) throw error;

      toast.success('Usuário criado com sucesso');
      setCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('user');
      fetchUsers();
    } catch (error: unknown) {
      console.error('Erro ao criar usuário:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar usuário');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', userId }
      });

      if (error) throw error;

      toast.success('Usuário excluído com sucesso');
      fetchUsers();
    } catch (error: unknown) {
      console.error('Erro ao excluir usuário:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir usuário');
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'supervisor' | 'user') => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'update_role', userId, role: newRole }
      });

      if (error) throw error;

      toast.success('Permissão atualizada com sucesso');
      
      // Atualizar lista de usuários
      fetchUsers();
      
      // Atualizar perfil do usuário atual se alterou a própria role
      await refreshUserProfile();
    } catch (error: unknown) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar permissão');
    }
  };

  const resetPassword = async () => {
    if (!selectedUserForReset || !newPassword) {
      toast.error('Digite a nova senha');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset_password',
          userId: selectedUserForReset.id,
          password: newPassword
        }
      });

      if (error) throw error;

      toast.success(`Senha de ${selectedUserForReset.full_name || selectedUserForReset.email} alterada com sucesso`);
      setResetPasswordDialogOpen(false);
      setSelectedUserForReset(null);
      setNewPassword('');
    } catch (error: unknown) {
      console.error('Erro ao resetar senha:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao resetar senha');
    }
  };

  const openResetPasswordDialog = (user: UserProfile) => {
    setSelectedUserForReset(user);
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription>
            Acesso restrito a administradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciamento de Usuários
            </CardTitle>
            <CardDescription>
              Crie e gerencie usuários do sistema
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo usuário
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="joao@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Permissão</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'admin' | 'supervisor' | 'user')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário Comum</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createUser} className="w-full">
                  Criar Usuário
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name || 'Sem nome'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(v) => updateUserRole(user.id, v as 'admin' | 'supervisor' | 'user')}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário Comum</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/settings/users/${user.id}`)}
                    title="Detalhes do usuário"
                  >
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openResetPasswordDialog(user)}
                    title="Resetar senha"
                  >
                    <KeyRound className="h-4 w-4 text-amber-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteUser(user.id)}
                    title="Excluir usuário"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Dialog de Reset de Senha */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resetar Senha</DialogTitle>
              <DialogDescription>
                Definir nova senha para {selectedUserForReset?.full_name || selectedUserForReset?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              <Button onClick={resetPassword} className="w-full">
                Salvar Nova Senha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
