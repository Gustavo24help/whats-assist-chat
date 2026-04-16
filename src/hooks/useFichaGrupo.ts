import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GrupoMembro {
  id: string;
  grupo_id: string;
  ficha_id: string;
  papel: string;
  adicionado_em: string;
  adicionado_por: string | null;
}

interface FichaGrupoData {
  grupoId: string | null;
  fichaPrincipalId: string | null;
  isPrincipal: boolean;
  isVinculada: boolean;
  membros: GrupoMembro[];
  outrosMembros: GrupoMembro[];
  loading: boolean;
  refetch: () => void;
}

export function useFichaGrupo(fichaId: string | null): FichaGrupoData {
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [fichaPrincipalId, setFichaPrincipalId] = useState<string | null>(null);
  const [membros, setMembros] = useState<GrupoMembro[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGrupo = useCallback(async () => {
    if (!fichaId) {
      setGrupoId(null);
      setFichaPrincipalId(null);
      setMembros([]);
      return;
    }

    setLoading(true);
    try {
      // Check if this ficha belongs to a group
      const { data: membroData } = await supabase
        .from("ficha_grupo_membros")
        .select("*")
        .eq("ficha_id", fichaId)
        .maybeSingle();

      if (!membroData) {
        setGrupoId(null);
        setFichaPrincipalId(null);
        setMembros([]);
        setLoading(false);
        return;
      }

      const gId = membroData.grupo_id;

      // Fetch group info
      const { data: grupoData } = await supabase
        .from("ficha_grupos")
        .select("*")
        .eq("id", gId)
        .single();

      // Fetch all members
      const { data: allMembros } = await supabase
        .from("ficha_grupo_membros")
        .select("*")
        .eq("grupo_id", gId);

      setGrupoId(gId);
      setFichaPrincipalId(grupoData?.ficha_principal_id || null);
      setMembros(allMembros || []);
    } catch (err) {
      console.error("[useFichaGrupo] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [fichaId]);

  useEffect(() => {
    fetchGrupo();
  }, [fetchGrupo]);

  const isPrincipal = !!fichaPrincipalId && fichaPrincipalId === fichaId;
  const isVinculada = !!grupoId && !isPrincipal;
  const outrosMembros = membros.filter((m) => m.ficha_id !== fichaId);

  return {
    grupoId,
    fichaPrincipalId,
    isPrincipal,
    isVinculada,
    membros,
    outrosMembros,
    loading,
    refetch: fetchGrupo,
  };
}

/** Vincular fichaId a uma ficha principal (targetFichaId). Creates or reuses group. */
export async function vincularFichas(
  fichaIdVinculada: string,
  fichaIdPrincipal: string,
  userId?: string,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if principal already belongs to a group
    const { data: existingMembro } = await supabase
      .from("ficha_grupo_membros")
      .select("grupo_id")
      .eq("ficha_id", fichaIdPrincipal)
      .maybeSingle();

    // Check if vinculada already belongs to a group
    const { data: vinculadaMembro } = await supabase
      .from("ficha_grupo_membros")
      .select("grupo_id")
      .eq("ficha_id", fichaIdVinculada)
      .maybeSingle();

    if (vinculadaMembro) {
      return { success: false, error: "Esta ficha já está vinculada a outro grupo." };
    }

    let grupoId: string;

    if (existingMembro) {
      // Principal already in a group, add vinculada to it
      grupoId = existingMembro.grupo_id;
    } else {
      // Create new group
      const { data: newGrupo, error: grupoErr } = await supabase
        .from("ficha_grupos")
        .insert({
          ficha_principal_id: fichaIdPrincipal,
          criado_por: userId || null,
          motivo: motivo || null,
        })
        .select("id")
        .single();

      if (grupoErr || !newGrupo) {
        return { success: false, error: "Erro ao criar grupo." };
      }

      grupoId = newGrupo.id;

      // Add principal as member
      await supabase.from("ficha_grupo_membros").insert({
        grupo_id: grupoId,
        ficha_id: fichaIdPrincipal,
        papel: "principal",
        adicionado_por: userId || null,
      });
    }

    // Add vinculada as member
    const { error: insertErr } = await supabase.from("ficha_grupo_membros").insert({
      grupo_id: grupoId,
      ficha_id: fichaIdVinculada,
      papel: "vinculada",
      adicionado_por: userId || null,
    });

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Desvincular uma ficha do grupo. If only principal remains, delete group. */
export async function desvincularFicha(
  fichaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: membro } = await supabase
      .from("ficha_grupo_membros")
      .select("id, grupo_id, papel")
      .eq("ficha_id", fichaId)
      .maybeSingle();

    if (!membro) {
      return { success: false, error: "Ficha não está vinculada a nenhum grupo." };
    }

    // Remove this member
    await supabase.from("ficha_grupo_membros").delete().eq("id", membro.id);

    // Check remaining members
    const { data: remaining } = await supabase
      .from("ficha_grupo_membros")
      .select("id")
      .eq("grupo_id", membro.grupo_id);

    if (!remaining || remaining.length <= 1) {
      // Delete remaining members and the group
      await supabase.from("ficha_grupo_membros").delete().eq("grupo_id", membro.grupo_id);
      await supabase.from("ficha_grupos").delete().eq("id", membro.grupo_id);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
