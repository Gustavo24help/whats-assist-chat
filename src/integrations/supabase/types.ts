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
      adiantamentos: {
        Row: {
          compensado_em: string | null
          created_at: string | null
          criado_por: string | null
          data_adiantamento: string
          ficha_id: string | null
          id: string
          motivo: string | null
          prestador_id: string
          status: string
          transacao_id: string | null
          valor: number
        }
        Insert: {
          compensado_em?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_adiantamento?: string
          ficha_id?: string | null
          id?: string
          motivo?: string | null
          prestador_id: string
          status?: string
          transacao_id?: string | null
          valor?: number
        }
        Update: {
          compensado_em?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_adiantamento?: string
          ficha_id?: string | null
          id?: string
          motivo?: string | null
          prestador_id?: string
          status?: string
          transacao_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "adiantamentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_prestador: {
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
      aviso_destinatarios: {
        Row: {
          aviso_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          aviso_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          aviso_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_destinatarios_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      aviso_leituras: {
        Row: {
          aviso_id: string
          id: string
          lido_em: string
          user_id: string
        }
        Insert: {
          aviso_id: string
          id?: string
          lido_em?: string
          user_id: string
        }
        Update: {
          aviso_id?: string
          id?: string
          lido_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_leituras_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos: {
        Row: {
          arquivado: boolean
          conteudo: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          enviar_para_todos: boolean
          enviar_popup: boolean
          id: string
          imagem_url: string | null
          titulo: string
        }
        Insert: {
          arquivado?: boolean
          conteudo: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          enviar_para_todos?: boolean
          enviar_popup?: boolean
          id?: string
          imagem_url?: string | null
          titulo: string
        }
        Update: {
          arquivado?: boolean
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          enviar_para_todos?: boolean
          enviar_popup?: boolean
          id?: string
          imagem_url?: string | null
          titulo?: string
        }
        Relationships: []
      }
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
      conta_corrente_prestador: {
        Row: {
          adiantamento_id: string | null
          created_at: string | null
          criado_por: string | null
          data_movimentacao: string
          descricao: string
          id: string
          origem: string
          prestador_id: string
          saldo_anterior: number
          saldo_atual: number
          tipo: string
          transacao_id: string | null
          valor: number
        }
        Insert: {
          adiantamento_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_movimentacao?: string
          descricao?: string
          id?: string
          origem: string
          prestador_id: string
          saldo_anterior?: number
          saldo_atual?: number
          tipo: string
          transacao_id?: string | null
          valor?: number
        }
        Update: {
          adiantamento_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_movimentacao?: string
          descricao?: string
          id?: string
          origem?: string
          prestador_id?: string
          saldo_anterior?: number
          saldo_atual?: number
          tipo?: string
          transacao_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "conta_corrente_prestador_adiantamento_id_fkey"
            columns: ["adiantamento_id"]
            isOneToOne: false
            referencedRelation: "adiantamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_corrente_prestador_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_goals: {
        Row: {
          created_at: string | null
          date: string
          id: string
          meta_agendamento_quantidade: number
          meta_agendamento_valor: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          meta_agendamento_quantidade?: number
          meta_agendamento_valor?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          meta_agendamento_quantidade?: number
          meta_agendamento_valor?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_metas: {
        Row: {
          created_at: string | null
          id: string
          lucro_bruto: number | null
          quantidade_agendados: number | null
          quantidade_fs: number | null
          quantidade_servicos: number | null
          taxa_agendado_pago: number | null
          taxa_conversao_total: number | null
          taxa_fs_agendado: number | null
          tempo_orcamento_max: number | null
          tempo_resposta_max: number | null
          ticket_medio: number | null
          tipo: string
          updated_at: string | null
          valor_os: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lucro_bruto?: number | null
          quantidade_agendados?: number | null
          quantidade_fs?: number | null
          quantidade_servicos?: number | null
          taxa_agendado_pago?: number | null
          taxa_conversao_total?: number | null
          taxa_fs_agendado?: number | null
          tempo_orcamento_max?: number | null
          tempo_resposta_max?: number | null
          ticket_medio?: number | null
          tipo?: string
          updated_at?: string | null
          valor_os?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lucro_bruto?: number | null
          quantidade_agendados?: number | null
          quantidade_fs?: number | null
          quantidade_servicos?: number | null
          taxa_agendado_pago?: number | null
          taxa_conversao_total?: number | null
          taxa_fs_agendado?: number | null
          tempo_orcamento_max?: number | null
          tempo_resposta_max?: number | null
          ticket_medio?: number | null
          tipo?: string
          updated_at?: string | null
          valor_os?: number | null
        }
        Relationships: []
      }
      descontos_ajustes: {
        Row: {
          created_at: string | null
          criado_por: string | null
          id: string
          motivo: string
          percentual: number | null
          tipo: string
          transacao_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          id?: string
          motivo?: string
          percentual?: number | null
          tipo: string
          transacao_id: string
          valor?: number
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          id?: string
          motivo?: string
          percentual?: number | null
          tipo?: string
          transacao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "descontos_ajustes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_status_historico: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          ficha_id: string
          id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          ficha_id: string
          id?: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          ficha_id?: string
          id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficha_status_historico_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas_de_servico: {
        Row: {
          bairro: string | null
          categoria_id: number | null
          cidade: string | null
          comparecimento_prestador: string | null
          cpf: string | null
          created_at: string | null
          data_retorno: string | null
          data_version: number | null
          data_visita_tecnica: string | null
          desconto_percentual_mao_obra: number | null
          desconto_percentual_pecas: number | null
          desconto_valor_mao_obra: number | null
          desconto_valor_pecas: number | null
          descricao: string | null
          endereco: string | null
          formulario_orcamento_ativo: boolean | null
          formulario_orcamento_data_primeiro_envio: string | null
          formulario_orcamento_encerrado_em: string | null
          hora_fim_agendamento: string | null
          hora_fim_retorno: string | null
          hora_inicio_agendamento: string | null
          hora_inicio_retorno: string | null
          horario_agendamento: string | null
          horario_visita_tecnica: string | null
          id: string
          id_zoho: string | null
          motivo_perda: string | null
          motivo_troca_prestador: string | null
          nome_cliente: string | null
          nome_ficha: string | null
          notas: string | null
          observacao_financeira: string | null
          observacao_financeira_por: string | null
          pagamento_gerar_link: boolean | null
          pagamento_link: string | null
          pagamento_parcelas: number | null
          pagamento_realizado: boolean | null
          pagamento_tipo:
            | Database["public"]["Enums"]["tipo_pagamento_enum"]
            | null
          pagamento_visto_por_chefe: boolean | null
          preferencia_horario_cliente: string | null
          prestador_anterior_id: string | null
          prestador_id: string | null
          recibo_url: string | null
          status: Database["public"]["Enums"]["status_ficha_enum"] | null
          subtotal: number | null
          telefone_cliente: string
          tempo_servico: string | null
          tipo_agendamento: string | null
          tipo_desconto_mao_obra: string | null
          tipo_desconto_pecas: string | null
          updated_at: string | null
          valor_antes_arredondamento: number | null
          valor_final_mao_obra: number | null
          valor_final_pecas: number | null
          valor_mao_obra: number | null
          valor_pecas: number | null
          valor_total: number | null
          webhook_pendente: boolean | null
        }
        Insert: {
          bairro?: string | null
          categoria_id?: number | null
          cidade?: string | null
          comparecimento_prestador?: string | null
          cpf?: string | null
          created_at?: string | null
          data_retorno?: string | null
          data_version?: number | null
          data_visita_tecnica?: string | null
          desconto_percentual_mao_obra?: number | null
          desconto_percentual_pecas?: number | null
          desconto_valor_mao_obra?: number | null
          desconto_valor_pecas?: number | null
          descricao?: string | null
          endereco?: string | null
          formulario_orcamento_ativo?: boolean | null
          formulario_orcamento_data_primeiro_envio?: string | null
          formulario_orcamento_encerrado_em?: string | null
          hora_fim_agendamento?: string | null
          hora_fim_retorno?: string | null
          hora_inicio_agendamento?: string | null
          hora_inicio_retorno?: string | null
          horario_agendamento?: string | null
          horario_visita_tecnica?: string | null
          id: string
          id_zoho?: string | null
          motivo_perda?: string | null
          motivo_troca_prestador?: string | null
          nome_cliente?: string | null
          nome_ficha?: string | null
          notas?: string | null
          observacao_financeira?: string | null
          observacao_financeira_por?: string | null
          pagamento_gerar_link?: boolean | null
          pagamento_link?: string | null
          pagamento_parcelas?: number | null
          pagamento_realizado?: boolean | null
          pagamento_tipo?:
            | Database["public"]["Enums"]["tipo_pagamento_enum"]
            | null
          pagamento_visto_por_chefe?: boolean | null
          preferencia_horario_cliente?: string | null
          prestador_anterior_id?: string | null
          prestador_id?: string | null
          recibo_url?: string | null
          status?: Database["public"]["Enums"]["status_ficha_enum"] | null
          subtotal?: number | null
          telefone_cliente: string
          tempo_servico?: string | null
          tipo_agendamento?: string | null
          tipo_desconto_mao_obra?: string | null
          tipo_desconto_pecas?: string | null
          updated_at?: string | null
          valor_antes_arredondamento?: number | null
          valor_final_mao_obra?: number | null
          valor_final_pecas?: number | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
          webhook_pendente?: boolean | null
        }
        Update: {
          bairro?: string | null
          categoria_id?: number | null
          cidade?: string | null
          comparecimento_prestador?: string | null
          cpf?: string | null
          created_at?: string | null
          data_retorno?: string | null
          data_version?: number | null
          data_visita_tecnica?: string | null
          desconto_percentual_mao_obra?: number | null
          desconto_percentual_pecas?: number | null
          desconto_valor_mao_obra?: number | null
          desconto_valor_pecas?: number | null
          descricao?: string | null
          endereco?: string | null
          formulario_orcamento_ativo?: boolean | null
          formulario_orcamento_data_primeiro_envio?: string | null
          formulario_orcamento_encerrado_em?: string | null
          hora_fim_agendamento?: string | null
          hora_fim_retorno?: string | null
          hora_inicio_agendamento?: string | null
          hora_inicio_retorno?: string | null
          horario_agendamento?: string | null
          horario_visita_tecnica?: string | null
          id?: string
          id_zoho?: string | null
          motivo_perda?: string | null
          motivo_troca_prestador?: string | null
          nome_cliente?: string | null
          nome_ficha?: string | null
          notas?: string | null
          observacao_financeira?: string | null
          observacao_financeira_por?: string | null
          pagamento_gerar_link?: boolean | null
          pagamento_link?: string | null
          pagamento_parcelas?: number | null
          pagamento_realizado?: boolean | null
          pagamento_tipo?:
            | Database["public"]["Enums"]["tipo_pagamento_enum"]
            | null
          pagamento_visto_por_chefe?: boolean | null
          preferencia_horario_cliente?: string | null
          prestador_anterior_id?: string | null
          prestador_id?: string | null
          recibo_url?: string | null
          status?: Database["public"]["Enums"]["status_ficha_enum"] | null
          subtotal?: number | null
          telefone_cliente?: string
          tempo_servico?: string | null
          tipo_agendamento?: string | null
          tipo_desconto_mao_obra?: string | null
          tipo_desconto_pecas?: string | null
          updated_at?: string | null
          valor_antes_arredondamento?: number | null
          valor_final_mao_obra?: number | null
          valor_final_pecas?: number | null
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
      internal_conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversations: {
        Row: {
          created_at: string
          group_name: string | null
          id: string
          is_group: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_name?: string | null
          id?: string
          is_group?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_name?: string | null
          id?: string
          is_group?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      mensagens_backup_27fev: {
        Row: {
          arquivo_url: string | null
          cliente_id: string | null
          data_hora: string | null
          enviado_por_id: string | null
          ficha_id: string | null
          id: string | null
          message_sid: string | null
          remetente: string | null
          reply_to_message_id: string | null
          status: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
        }
        Insert: {
          arquivo_url?: string | null
          cliente_id?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string | null
          message_sid?: string | null
          remetente?: string | null
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
        }
        Update: {
          arquivo_url?: string | null
          cliente_id?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string | null
          message_sid?: string | null
          remetente?: string | null
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
        }
        Relationships: []
      }
      mensagens_backup_queue: {
        Row: {
          cliente_id: string
          created_at: string | null
          erro_ultimo: string | null
          id: string
          message_sid: string | null
          payload: Json
          processado: boolean | null
          tentativas: number | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          erro_ultimo?: string | null
          id?: string
          message_sid?: string | null
          payload: Json
          processado?: boolean | null
          tentativas?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          erro_ultimo?: string | null
          id?: string
          message_sid?: string | null
          payload?: Json
          processado?: boolean | null
          tentativas?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      notificacoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          lida: boolean
          referencia_id: string | null
          tipo: string
          titulo: string
          usuario_destino: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          referencia_id?: string | null
          tipo?: string
          titulo: string
          usuario_destino: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          referencia_id?: string | null
          tipo?: string
          titulo?: string
          usuario_destino?: string
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
      prestador_historico: {
        Row: {
          created_at: string
          criado_por: string | null
          dados_extras: Json | null
          descricao: string
          ficha_id: string | null
          id: string
          prestador_cpf: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          dados_extras?: Json | null
          descricao: string
          ficha_id?: string | null
          id?: string
          prestador_cpf: string
          tipo_evento: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          dados_extras?: Json | null
          descricao?: string
          ficha_id?: string | null
          id?: string
          prestador_cpf?: string
          tipo_evento?: string
        }
        Relationships: []
      }
      prestadores: {
        Row: {
          ativo: boolean
          banco: string | null
          categoria: string | null
          chave_pix: string | null
          cnpj: string | null
          cpf: string
          created_at: string | null
          especialidade: string | null
          id_azure: string | null
          id_crm: string | null
          nome: string
          nome_pix: string | null
          telefone: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          categoria?: string | null
          chave_pix?: string | null
          cnpj?: string | null
          cpf: string
          created_at?: string | null
          especialidade?: string | null
          id_azure?: string | null
          id_crm?: string | null
          nome: string
          nome_pix?: string | null
          telefone: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          categoria?: string | null
          chave_pix?: string | null
          cnpj?: string | null
          cpf?: string
          created_at?: string | null
          especialidade?: string | null
          id_azure?: string | null
          id_crm?: string | null
          nome?: string
          nome_pix?: string | null
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
      takeover_requests: {
        Row: {
          created_at: string
          id: string
          operador_atual_id: string
          responded_at: string | null
          solicitante_id: string
          solicitante_nome: string
          status: string
          telefone_cliente: string
        }
        Insert: {
          created_at?: string
          id?: string
          operador_atual_id: string
          responded_at?: string | null
          solicitante_id: string
          solicitante_nome: string
          status?: string
          telefone_cliente: string
        }
        Update: {
          created_at?: string
          id?: string
          operador_atual_id?: string
          responded_at?: string | null
          solicitante_id?: string
          solicitante_nome?: string
          status?: string
          telefone_cliente?: string
        }
        Relationships: []
      }
      transacoes_financeiras: {
        Row: {
          adiantamento_cliente: number
          adiantamento_prestador: number
          agencia_prestador: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_por: string | null
          banco_prestador: string | null
          categoria: string | null
          cliente_id: string
          cliente_nome: string
          conta_prestador: string | null
          created_at: string | null
          criado_por: string | null
          data_contratacao: string | null
          data_execucao: string
          data_pagamento_prevista: string
          data_pagamento_realizada: string | null
          ficha_id: string
          forma_pagamento_cliente: string | null
          id: string
          link_pagamento_asaas: string | null
          margem_operacional_real: number
          margem_percentual: number
          material_pago_24help: boolean
          observacoes: string | null
          pix_prestador: string | null
          prestador_cnpj: string | null
          prestador_codigo: string | null
          prestador_cpf: string | null
          prestador_id: string
          prestador_nome: string
          sheets_row_id: string | null
          sincronizado_em: string | null
          sincronizado_sheets: boolean | null
          status_pagamento_cliente: string
          status_pagamento_prestador: string
          taxa_visita: number
          tem_adiantamento: boolean | null
          tem_desconto: boolean | null
          updated_at: string | null
          valor_a_pagar_prestador: number
          valor_cliente_calculado: number
          valor_cliente_final: number
          valor_lucro_bruto: number
          valor_mao_obra: number
          valor_material: number
          valor_subtotal: number
        }
        Insert: {
          adiantamento_cliente?: number
          adiantamento_prestador?: number
          agencia_prestador?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_por?: string | null
          banco_prestador?: string | null
          categoria?: string | null
          cliente_id: string
          cliente_nome?: string
          conta_prestador?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_contratacao?: string | null
          data_execucao?: string
          data_pagamento_prevista: string
          data_pagamento_realizada?: string | null
          ficha_id: string
          forma_pagamento_cliente?: string | null
          id?: string
          link_pagamento_asaas?: string | null
          margem_operacional_real?: number
          margem_percentual?: number
          material_pago_24help?: boolean
          observacoes?: string | null
          pix_prestador?: string | null
          prestador_cnpj?: string | null
          prestador_codigo?: string | null
          prestador_cpf?: string | null
          prestador_id: string
          prestador_nome: string
          sheets_row_id?: string | null
          sincronizado_em?: string | null
          sincronizado_sheets?: boolean | null
          status_pagamento_cliente?: string
          status_pagamento_prestador?: string
          taxa_visita?: number
          tem_adiantamento?: boolean | null
          tem_desconto?: boolean | null
          updated_at?: string | null
          valor_a_pagar_prestador?: number
          valor_cliente_calculado?: number
          valor_cliente_final?: number
          valor_lucro_bruto?: number
          valor_mao_obra?: number
          valor_material?: number
          valor_subtotal?: number
        }
        Update: {
          adiantamento_cliente?: number
          adiantamento_prestador?: number
          agencia_prestador?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_por?: string | null
          banco_prestador?: string | null
          categoria?: string | null
          cliente_id?: string
          cliente_nome?: string
          conta_prestador?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_contratacao?: string | null
          data_execucao?: string
          data_pagamento_prevista?: string
          data_pagamento_realizada?: string | null
          ficha_id?: string
          forma_pagamento_cliente?: string | null
          id?: string
          link_pagamento_asaas?: string | null
          margem_operacional_real?: number
          margem_percentual?: number
          material_pago_24help?: boolean
          observacoes?: string | null
          pix_prestador?: string | null
          prestador_cnpj?: string | null
          prestador_codigo?: string | null
          prestador_cpf?: string | null
          prestador_id?: string
          prestador_nome?: string
          sheets_row_id?: string | null
          sincronizado_em?: string | null
          sincronizado_sheets?: boolean | null
          status_pagamento_cliente?: string
          status_pagamento_prestador?: string
          taxa_visita?: number
          tem_adiantamento?: boolean | null
          tem_desconto?: boolean | null
          updated_at?: string | null
          valor_a_pagar_prestador?: number
          valor_cliente_calculado?: number
          valor_cliente_final?: number
          valor_lucro_bruto?: number
          valor_mao_obra?: number
          valor_material?: number
          valor_subtotal?: number
        }
        Relationships: []
      }
      tv_layouts: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          nome: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          nome?: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          nome?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      twilio_sync_control: {
        Row: {
          errors: number | null
          id: string
          last_message_sid: string | null
          last_sync_timestamp: string
          messages_already_exist: number | null
          messages_found: number | null
          messages_new: number | null
          sync_in_progress: boolean | null
          sync_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          errors?: number | null
          id?: string
          last_message_sid?: string | null
          last_sync_timestamp?: string
          messages_already_exist?: number | null
          messages_found?: number | null
          messages_new?: number | null
          sync_in_progress?: boolean | null
          sync_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          errors?: number | null
          id?: string
          last_message_sid?: string | null
          last_sync_timestamp?: string
          messages_already_exist?: number | null
          messages_found?: number | null
          messages_new?: number | null
          sync_in_progress?: boolean | null
          sync_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_custom_permissions: {
        Row: {
          created_at: string
          id: string
          permission_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_internal_history: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          history_type: string
          id: string
          metadata: Json | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          history_type: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          history_type?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_internal_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_internal_profiles: {
        Row: {
          admission_date: string | null
          created_at: string
          position_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admission_date?: string | null
          created_at?: string
          position_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admission_date?: string | null
          created_at?: string
          position_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_internal_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_position_options: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
      webhook_debug_logs: {
        Row: {
          client_phone: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          message_sid: string | null
          processed_data: Json | null
          raw_payload: Json | null
          source: string
          step: string
          success: boolean
          timestamp: string
        }
        Insert: {
          client_phone?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          message_sid?: string | null
          processed_data?: Json | null
          raw_payload?: Json | null
          source: string
          step: string
          success?: boolean
          timestamp?: string
        }
        Update: {
          client_phone?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          message_sid?: string | null
          processed_data?: Json | null
          raw_payload?: Json | null
          source?: string
          step?: string
          success?: boolean
          timestamp?: string
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
      adicionar_dias_uteis: {
        Args: { data_base: string; dias: number }
        Returns: string
      }
      arredondar_para_8: { Args: { valor: number }; Returns: number }
      calculate_conversas_iniciadas: {
        Args: {
          p_categoria_id?: number
          p_cliente_telefone?: string
          p_from_date: string
          p_prestador_cpf?: string
          p_to_date: string
        }
        Returns: number
      }
      check_and_close_orcamento_forms: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "supervisor" | "chefe"
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
        | "Retorno"
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
      app_role: ["admin", "user", "supervisor", "chefe"],
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
        "Retorno",
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
