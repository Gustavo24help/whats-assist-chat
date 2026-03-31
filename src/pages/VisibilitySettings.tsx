import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTaskAuth } from '@/hooks/useTaskAuth'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Eye, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageLayout } from '@/components/PageLayout'

interface ProfileInfo {
  id: string
  full_name: string | null
}

export default function VisibilitySettings() {
  const navigate = useNavigate()
  const { currentMember, isManager, loading: authLoading } = useTaskAuth()
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [authorizedViewers, setAuthorizedViewers] = useState<Set<string>>(new Set())
  const [canSeeOwners, setCanSeeOwners] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentMember) return
    if (isManager) { navigate('/tarefas'); return }

    const load = async () => {
      setLoading(true)

      // Fetch all profiles except current user
      const { data: allProfiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name')
        .neq('id', currentMember.id)

      setProfiles((allProfiles ?? []).filter((p: ProfileInfo) => p.full_name))

      // Who I authorized to see my tasks
      const { data: authorized } = await (supabase as any)
        .from('task_visibility')
        .select('viewer_id')
        .eq('owner_id', currentMember.id)

      setAuthorizedViewers(new Set((authorized ?? []).map((r: any) => r.viewer_id)))

      // Who authorized me to see their tasks
      const { data: canSee } = await (supabase as any)
        .from('task_visibility')
        .select('owner_id')
        .eq('viewer_id', currentMember.id)

      setCanSeeOwners(new Set((canSee ?? []).map((r: any) => r.owner_id)))

      setLoading(false)
    }

    load()
  }, [currentMember?.id, isManager])

  const toggleViewer = async (viewerId: string) => {
    if (!currentMember) return
    setSaving(true)

    try {
      if (authorizedViewers.has(viewerId)) {
        await (supabase as any)
          .from('task_visibility')
          .delete()
          .eq('owner_id', currentMember.id)
          .eq('viewer_id', viewerId)

        setAuthorizedViewers(prev => {
          const next = new Set(prev)
          next.delete(viewerId)
          return next
        })
        toast.success('Permissão removida')
      } else {
        await (supabase as any)
          .from('task_visibility')
          .insert({ owner_id: currentMember.id, viewer_id: viewerId })

        setAuthorizedViewers(prev => new Set(prev).add(viewerId))
        toast.success('Permissão concedida')
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    )
  }

  if (!currentMember) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center flex-1">
          <p className="text-foreground">Sem permissão.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto overflow-auto flex-1">
      <Button
        variant="ghost"
        onClick={() => navigate('/tarefas')}
        className="mb-4 text-primary"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para Tarefas
      </Button>

      <h1 className="text-2xl font-bold text-[#004A30] mb-6">Configurações de Visibilidade</h1>

      {/* Section 1: Who can see my tasks */}
      <Card className="mb-6 bg-white">
        <CardHeader>
          <CardTitle className="text-[#004A30] flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Quem pode ver minhas tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#2C2C2A]/60 mb-4">
            Marque os colegas que terão acesso para visualizar suas tarefas.
          </p>
          <div className="space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <Checkbox
                  id={`viewer-${p.id}`}
                  checked={authorizedViewers.has(p.id)}
                  onCheckedChange={() => toggleViewer(p.id)}
                  disabled={saving}
                />
                <Label htmlFor={`viewer-${p.id}`} className="text-sm text-[#2C2C2A] cursor-pointer">
                  {p.full_name}
                </Label>
              </div>
            ))}
            {profiles.length === 0 && (
              <p className="text-sm text-[#2C2C2A]/40">Nenhum outro membro encontrado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Whose tasks I can see */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-[#004A30] flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5" />
            Estou vendo tarefas de
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#2C2C2A]/60 mb-4">
            Membros que autorizaram você a ver as tarefas deles (somente leitura).
          </p>
          <div className="space-y-2">
            {profiles
              .filter(p => canSeeOwners.has(p.id))
              .map(p => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[#004A30]/5 rounded">
                  <Eye className="h-4 w-4 text-[#004A30]" />
                  <span className="text-sm text-[#2C2C2A]">{p.full_name}</span>
                </div>
              ))}
            {profiles.filter(p => canSeeOwners.has(p.id)).length === 0 && (
              <p className="text-sm text-[#2C2C2A]/40">Nenhum membro autorizou você ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </PageLayout>
  )
}
