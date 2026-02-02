export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bot_historico: {
        Row: {
          acao: string
          created_at: string
          executado_por_id: string | null
          ficha_id: string | null
          id: string
          ip_address: string | null
          observacao: string | null
          origem: string
          request_id: string | null
          telefone_cliente: string
          user_agent: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          executado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          ip_address?: string | null
          observacao?: string | null
          origem: string
          request_id?: string | null
          telefone_cliente: string
          user_agent?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          executado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          ip_address?: string | null
          observacao?: string | null
          origem?: string
          request_id?: string | null
          telefone_cliente?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_historico_executado_por_id_fkey"
            columns: ["executado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_historico_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_historico_telefone_cliente_fkey"
            columns: ["telefone_cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["telefone"]
          },
        ]
      }
      bot_reactivation_schedule: {
        Row: {
          created_at: string | null
          executed: boolean | null
          ficha_id: string
          id: string
          scheduled_at: string
          telefone_cliente: string
        }
        Insert: {
          created_at?: string | null
          executed?: boolean | null
          ficha_id: string
          id?: string
          scheduled_at: string
          telefone_cliente: string
        }
        Update: {
          created_at?: string | null
          executed?: boolean | null
          ficha_id?: string
          id?: string
          scheduled_at?: string
          telefone_cliente?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string | null
          id: number
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          arquivado: boolean
          atendente_id: string | null
          bairro: string | null
          bot_desativado_notificacao_vista: boolean | null
          bot_desligado_manualmente: boolean | null
          bot_habilitado: boolean | null
          bot_ja_desligado_alguma_vez: boolean | null
          cidade: string | null
          cpf: string | null
          created_at: string | null
          data_bot_desabilitado: string | null
          endereco: string | null
          ficha_ativa_id: string | null
          marcado_nao_lido: boolean | null
          nome: string
          notas_internas: string | null
          status_conversa:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags: string[] | null
          telefone: string
          ultima_interacao: string | null
        }
        Insert: {
          arquivado?: boolean
          atendente_id?: string | null
          bairro?: string | null
          bot_desativado_notificacao_vista?: boolean | null
          bot_desligado_manualmente?: boolean | null
          bot_habilitado?: boolean | null
          bot_ja_desligado_alguma_vez?: boolean | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_bot_desabilitado?: string | null
          endereco?: string | null
          ficha_ativa_id?: string | null
          marcado_nao_lido?: boolean | null
          nome?: string
          notas_internas?: string | null
          status_conversa?:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags?: string[] | null
          telefone: string
          ultima_interacao?: string | null
        }
        Update: {
          arquivado?: boolean
          atendente_id?: string | null
          bairro?: string | null
          bot_desativado_notificacao_vista?: boolean | null
          bot_desligado_manualmente?: boolean | null
          bot_habilitado?: boolean | null
          bot_ja_desligado_alguma_vez?: boolean | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_bot_desabilitado?: string | null
          endereco?: string | null
          ficha_ativa_id?: string | null
          marcado_nao_lido?: boolean | null
          nome?: string
          notas_internas?: string | null
          status_conversa?:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags?: string[] | null
          telefone?: string
          ultima_interacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      fichas_de_servico: {
        Row: {
          bairro: string | null
          categoria_id: number | null
          cidade: string | null
          cpf: string | null
          created_at: string | null
          data_version: number | null
          data_visita_tecnica: string | null
          descricao: string | null
          endereco: string | null
          formulario_orcamento_ativo: boolean | null
          formulario_orcamento_data_primeiro_envio: string | null
          formulario_orcamento_encerrado_em: string | null
          horario_agendamento: string | null
          horario_visita_tecnica: string | null
          id: string
          id_zoho: string | null
          motivo_perda: string | null
          nome_cliente: string | null
          nome_ficha: string | null
          notas: string | null
          pagamento_gerar_link: boolean | null
          pagamento_link: string | null
          pagamento_parcelas: number | null
          pagamento_realizado: boolean | null
          pagamento_tipo:
            | Database["public"]["Enums"]["tipo_pagamento_enum"]
            | null
          preferencia_horario_cliente: string | null
          prestador_id: string | null
          recibo_url: string | null
          status: Database["public"]["Enums"]["status_ficha_enum"] | null
          telefone_cliente: string
          tempo_servico: string | null
          updated_at: string | null
          valor_mao_obra: number | null
          valor_pecas: number | null
          valor_total: number | null
          webhook_pendente: boolean | null
        }
        Insert: {
          bairro?: string | null
          categoria_id?: number | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_version?: number | null
          data_visita_tecnica?: string | null
          descricao?: string | null
          endereco?: string | null
          formulario_orcamento_ativo?: boolean | null
          formulario_orcamento_data_primeiro_envio?: string | null
          formulario_orcamento_encerrado_em?: string | null
          horario_agendamento?: string | null
          horario_visita_tecnica?: string | null
          id: string
          id_zoho?: string | null
          motivo_perda?: string | null
          nome_cliente?: string | null
          nome_ficha?: string | null
          notas?: string | null
          pagamento_gerar_link?: boolean | null
          pagamento_link?: string | null
          pagamento_parcelas?: number | null
          pagamento_realizado?: boolean | null
          pagamento_tipo?:
            | Database["public"]["Enums"]["tipo_pagamento_enum"]
            | null
          preferencia_horario_cliente?: string | null
          prestador_id?: string | null
          recibo_url?: string | null
          status?: Database["public"]["Enums"]["status_ficha_enum"] | null
          telefone_cliente: string
          tempo_servico?: string | null
          updated_at?: string | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
          webhook_pendente?: boolean | null
        }
        Update: {
          bairro?: string | null
          categoria_id?: number | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_version?: number | null
          data_visita_tecnica?: string | null
          descricao?: string | null
          endereco?: string | null
          formulario_orcamento_ativo?: boolean | null
          formulario_orcamento_data_primeiro_envio?: string | null
          formulario_orcamento_encerrado_em?: string | null
          horario_agendamento?: string | null
          horario_visita_tecnica?: string | null
          id?: string
          id_zoho?: string | null
          motivo_perda?: string | null
          nome_cliente?: string | null
          nome_ficha?: string | null
          notas?: string | null
          pagamento_gerar_link?: boolean | null
          pagamento_link?: string | null
          pagamento_parcelas?: number | null
          pagamento_realizado?: boolean | null
          pagamento_tipo?:
            | Database["public"]["Enums"]["tipo_pagamento_enum"]
            | null
          preferencia_horario_cliente?: string | null
          prestador_id?: string | null
          recibo_url?: string | null
          status?: Database["public"]["Enums"]["status_ficha_enum"] | null
          telefone_cliente?: string
          tempo_servico?: string | null
          updated_at?: string | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
          webhook_pendente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fichas_de_servico_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_de_servico_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["cpf"]
          },
          {
            foreignKeyName: "fichas_de_servico_telefone_cliente_fkey"
            columns: ["telefone_cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["telefone"]
          },
        ]
      }
      google_ads_metrics: {
        Row: {
          campanha: string | null
          cliques: number | null
          conversoes: number | null
          cpa: number | null
          created_at: string | null
          ctr: number | null
          custo: number | null
          data_referencia: string
          id: string
          impressoes: number | null
          updated_at: string | null
        }
        Insert: {
          campanha?: string | null
          cliques?: number | null
          conversoes?: number | null
          cpa?: number | null
          created_at?: string | null
          ctr?: number | null
          custo?: number | null
          data_referencia: string
          id?: string
          impressoes?: number | null
          updated_at?: string | null
        }
        Update: {
          campanha?: string | null
          cliques?: number | null
          conversoes?: number | null
          cpa?: number | null
          created_at?: string | null
          ctr?: number | null
          custo?: number | null
          data_referencia?: string
          id?: string
          impressoes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          arquivo_url: string | null
          cliente_id: string
          data_hora: string | null
          enviado_por_id: string | null
          ficha_id: string | null
          id: string
          message_sid: string | null
          remetente: string
          reply_to_message_id: string | null
          status: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
        }
        Insert: {
          arquivo_url?: string | null
          cliente_id: string
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          message_sid?: string | null
          remetente: string
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
        }
        Update: {
          arquivo_url?: string | null
          cliente_id?: string
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          message_sid?: string | null
          remetente?: string
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["telefone"]
          },
          {
            foreignKeyName: "mensagens_enviado_por_id_fkey"
            columns: ["enviado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_padronizadas: {
        Row: {
          created_at: string | null
          id: string
          mensagem: string
          ordem: number
          tag: string | null
          titulo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mensagem: string
          ordem?: number
          tag?: string | null
          titulo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mensagem?: string
          ordem?: number
          tag?: string | null
          titulo?: string
        }
        Relationships: []
      }
      nps_respostas: {
        Row: {
          classificacao: string | null
          created_at: string
          enviado_em: string
          feedback: string | null
          feedback_respondido_em: string | null
          ficha_id: string
          id: string
          nota: number | null
          operador_id: string | null
          prestador_id: string | null
          prioridade: boolean | null
          respondido_em: string | null
          supervisor_alertado: boolean | null
          telefone_cliente: string
          tipo_feedback: string | null
        }
        Insert: {
          classificacao?: string | null
          created_at?: string
          enviado_em?: string
          feedback?: string | null
          feedback_respondido_em?: string | null
          ficha_id: string
          id?: string
          nota?: number | null
          operador_id?: string | null
          prestador_id?: string | null
          prioridade?: boolean | null
          respondido_em?: string | null
          supervisor_alertado?: boolean | null
          telefone_cliente: string
          tipo_feedback?: string | null
        }
        Update: {
          classificacao?: string | null
          created_at?: string
          enviado_em?: string
          feedback?: string | null
          feedback_respondido_em?: string | null
          ficha_id?: string
          id?: string
          nota?: number | null
          operador_id?: string | null
          prestador_id?: string | null
          prioridade?: boolean | null
          respondido_em?: string | null
          supervisor_alertado?: boolean | null
          telefone_cliente?: string
          tipo_feedback?: string | null
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          categoria: string | null
          data_criacao: string | null
          ficha_nome: string
          horario_sugerido: string | null
          id: string
          observacoes: string | null
          pode_horario: boolean | null
          prestador_cpf: string
          status: Database["public"]["Enums"]["status_orcamento_enum"] | null
          tempo_servico: string | null
          valor_mao_obra: number | null
          valor_pecas: number | null
          valor_total: number | null
        }
        Insert: {
          categoria?: string | null
          data_criacao?: string | null
          ficha_nome: string
          horario_sugerido?: string | null
          id?: string
          observacoes?: string | null
          pode_horario?: boolean | null
          prestador_cpf: string
          status?: Database["public"]["Enums"]["status_orcamento_enum"] | null
          tempo_servico?: string | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
        }
        Update: {
          categoria?: string | null
          data_criacao?: string | null
          ficha_nome?: string
          horario_sugerido?: string | null
          id?: string
          observacoes?: string | null
          pode_horario?: boolean | null
          prestador_cpf?: string
          status?: Database["public"]["Enums"]["status_orcamento_enum"] | null
          tempo_servico?: string | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
        }
        Relationships: []
      }
      prestadores: {
        Row: {
          categoria: string | null
          cnpj: string | null
          cpf: string
          created_at: string | null
          especialidade: string | null
          id_azure: string | null
          id_crm: string | null
          nome: string
          telefone: string
        }
        Insert: {
          categoria?: string | null
          cnpj?: string | null
          cpf: string
          created_at?: string | null
          especialidade?: string | null
          id_azure?: string | null
          id_crm?: string | null
          nome: string
          telefone: string
        }
        Update: {
          categoria?: string | null
          cnpj?: string | null
          cpf?: string
          created_at?: string | null
          especialidade?: string | null
          id_azure?: string | null
          id_crm?: string | null
          nome?: string
          telefone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          cor: string
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body: string
          content_sid: string
          created_at: string
          friendly_name: string
          id: string
          updated_at: string
          variable_mapping: Json | null
          variables: Json | null
        }
        Insert: {
          body: string
          content_sid: string
          created_at?: string
          friendly_name: string
          id?: string
          updated_at?: string
          variable_mapping?: Json | null
          variables?: Json | null
        }
        Update: {
          body?: string
          content_sid?: string
          created_at?: string
          friendly_name?: string
          id?: string
          updated_at?: string
          variable_mapping?: Json | null
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_close_orcamento_forms: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "supervisor"
      status_conversa_enum: "aberta" | "fechada"
      status_ficha_enum:
        | "Não foi adiante"
        | "Ficha Criada"
        | "Contato Inicial"
        | "Dúvida Prestador"
        | "Orçamento Enviado"
        | "Negociação"
        | "Visita Técnica"
        | "Orçamento Aprovado / Agendamento"
        | "Orçamento Não Aprovado"
        | "Agendado"
        | "Em andamento"
        | "Finalizado"
        | "Garantia"
        | "Perdido"
        | "pendente"
      status_mensagem_enum: "enviado" | "recebido" | "lido"
      status_orcamento_enum: "pendente" | "aprovado" | "rejeitado"
      tipo_mensagem_enum: "texto" | "arquivo" | "imagem" | "video" | "audio"
      tipo_pagamento_enum:
        | "dinheiro"
        | "cartao_credito"
        | "cartao_debito"
        | "pix"
        | "boleto"
        | "transferencia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "supervisor"],
      status_conversa_enum: ["aberta", "fechada"],
      status_ficha_enum: [
        "Não foi adiante",
        "Ficha Criada",
        "Contato Inicial",
        "Dúvida Prestador",
        "Orçamento Enviado",
        "Negociação",
        "Visita Técnica",
        "Orçamento Aprovado / Agendamento",
        "Orçamento Não Aprovado",
        "Agendado",
        "Em andamento",
        "Finalizado",
        "Garantia",
        "Perdido",
        "pendente",
      ],
      status_mensagem_enum: ["enviado", "recebido", "lido"],
      status_orcamento_enum: ["pendente", "aprovado", "rejeitado"],
      tipo_mensagem_enum: ["texto", "arquivo", "imagem", "video", "audio"],
      tipo_pagamento_enum: [
        "dinheiro",
        "cartao_credito",
        "cartao_debito",
        "pix",
        "boleto",
        "transferencia",
      ],
    },
  },
} as const
