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
      ajustes_data_finalizacao: {
        Row: {
          ajustado_por: string
          created_at: string | null
          data_anterior: string
          data_nova: string
          ficha_id: string
          id: string
          justificativa: string
          prestador_id: string | null
          prestador_nome: string | null
        }
        Insert: {
          ajustado_por: string
          created_at?: string | null
          data_anterior: string
          data_nova: string
          ficha_id: string
          id?: string
          justificativa: string
          prestador_id?: string | null
          prestador_nome?: string | null
        }
        Update: {
          ajustado_por?: string
          created_at?: string | null
          data_anterior?: string
          data_nova?: string
          ficha_id?: string
          id?: string
          justificativa?: string
          prestador_id?: string | null
          prestador_nome?: string | null
        }
        Relationships: []
      }
      atribuicao_cadeia: {
        Row: {
          created_at: string | null
          destino_user_id: string | null
          id: string
          ordem: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          destino_user_id?: string | null
          id?: string
          ordem?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          destino_user_id?: string | null
          id?: string
          ordem?: number
          user_id?: string
        }
        Relationships: []
      }
      automation_audit: {
        Row: {
          created_at: string
          detalhe: string | null
          etapa: string
          ficha_id: string
          id: string
          payment_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          etapa: string
          ficha_id: string
          id?: string
          payment_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          etapa?: string
          ficha_id?: string
          id?: string
          payment_id?: string | null
          status?: string
        }
        Relationships: []
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
          marcado_nao_lido_manual_em: string | null
          nome: string
          notas_internas: string | null
          numero_twilio: string | null
          status_conversa:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags: string[] | null
          telefone: string
          ultima_interacao: string | null
          ultima_mensagem_recebida: string | null
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
          marcado_nao_lido_manual_em?: string | null
          nome?: string
          notas_internas?: string | null
          numero_twilio?: string | null
          status_conversa?:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags?: string[] | null
          telefone: string
          ultima_interacao?: string | null
          ultima_mensagem_recebida?: string | null
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
          marcado_nao_lido_manual_em?: string | null
          nome?: string
          notas_internas?: string | null
          numero_twilio?: string | null
          status_conversa?:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags?: string[] | null
          telefone?: string
          ultima_interacao?: string | null
          ultima_mensagem_recebida?: string | null
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
      configuracao_ponto: {
        Row: {
          carga_diaria_minutos: number
          created_at: string
          hora_fim_prevista: string
          hora_inicio_prevista: string
          id: string
          saldo_inicial_minutos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          carga_diaria_minutos?: number
          created_at?: string
          hora_fim_prevista?: string
          hora_inicio_prevista?: string
          id?: string
          saldo_inicial_minutos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          carga_diaria_minutos?: number
          created_at?: string
          hora_fim_prevista?: string
          hora_inicio_prevista?: string
          id?: string
          saldo_inicial_minutos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      contas_receber: {
        Row: {
          asaas_id: string | null
          asaas_status: string | null
          cliente_nome: string | null
          cliente_telefone: string
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          ficha_id: string | null
          id: string
          link_enviado_em: string | null
          link_reenvio_count: number | null
          pagamento_link: string | null
          prestador_nome: string | null
          requer_template: boolean | null
          status: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          asaas_id?: string | null
          asaas_status?: string | null
          cliente_nome?: string | null
          cliente_telefone: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          ficha_id?: string | null
          id?: string
          link_enviado_em?: string | null
          link_reenvio_count?: number | null
          pagamento_link?: string | null
          prestador_nome?: string | null
          requer_template?: boolean | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          asaas_id?: string | null
          asaas_status?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          ficha_id?: string | null
          id?: string
          link_enviado_em?: string | null
          link_reenvio_count?: number | null
          pagamento_link?: string | null
          prestador_nome?: string | null
          requer_template?: boolean | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      conversa_ficha_vinculo: {
        Row: {
          ativo: boolean | null
          cliente_telefone: string | null
          ficha_id: string
          id: string
          prestador_telefone: string | null
          vinculado_em: string | null
          vinculado_por: string | null
        }
        Insert: {
          ativo?: boolean | null
          cliente_telefone?: string | null
          ficha_id: string
          id?: string
          prestador_telefone?: string | null
          vinculado_em?: string | null
          vinculado_por?: string | null
        }
        Update: {
          ativo?: boolean | null
          cliente_telefone?: string | null
          ficha_id?: string
          id?: string
          prestador_telefone?: string | null
          vinculado_em?: string | null
          vinculado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversa_ficha_vinculo_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      conversa_operador_leitura: {
        Row: {
          cliente_telefone: string
          created_at: string | null
          id: string
          mensagens_nao_lidas: number | null
          operador_id: string
          outro_operador_leu_em: string | null
          outro_operador_leu_id: string | null
          ultima_leitura: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_telefone: string
          created_at?: string | null
          id?: string
          mensagens_nao_lidas?: number | null
          operador_id: string
          outro_operador_leu_em?: string | null
          outro_operador_leu_id?: string | null
          ultima_leitura?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_telefone?: string
          created_at?: string | null
          id?: string
          mensagens_nao_lidas?: number | null
          operador_id?: string
          outro_operador_leu_em?: string | null
          outro_operador_leu_id?: string | null
          ultima_leitura?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversa_operador_leitura_cliente_telefone_fkey"
            columns: ["cliente_telefone"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["telefone"]
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
      ficha_coaching: {
        Row: {
          atualizado_em: string | null
          cliente_telefone: string
          conversao_base: number | null
          conversao_meta: number | null
          criado_em: string | null
          ficha_id: string | null
          id: string
          multiplos_orcamentos: number | null
          perguntas_tecnicas: number | null
          prioridade: string | null
          profile_cliente: string | null
          proximo_passo: string | null
          ratio_cliente_op: number | null
          sugestao_mensagem: string | null
          tempo_sem_resposta_minutos: number | null
          tpr_minutos: number | null
          ultima_msg_cliente: boolean | null
          urgencia: boolean | null
        }
        Insert: {
          atualizado_em?: string | null
          cliente_telefone: string
          conversao_base?: number | null
          conversao_meta?: number | null
          criado_em?: string | null
          ficha_id?: string | null
          id?: string
          multiplos_orcamentos?: number | null
          perguntas_tecnicas?: number | null
          prioridade?: string | null
          profile_cliente?: string | null
          proximo_passo?: string | null
          ratio_cliente_op?: number | null
          sugestao_mensagem?: string | null
          tempo_sem_resposta_minutos?: number | null
          tpr_minutos?: number | null
          ultima_msg_cliente?: boolean | null
          urgencia?: boolean | null
        }
        Update: {
          atualizado_em?: string | null
          cliente_telefone?: string
          conversao_base?: number | null
          conversao_meta?: number | null
          criado_em?: string | null
          ficha_id?: string | null
          id?: string
          multiplos_orcamentos?: number | null
          perguntas_tecnicas?: number | null
          prioridade?: string | null
          profile_cliente?: string | null
          proximo_passo?: string | null
          ratio_cliente_op?: number | null
          sugestao_mensagem?: string | null
          tempo_sem_resposta_minutos?: number | null
          tpr_minutos?: number | null
          ultima_msg_cliente?: boolean | null
          urgencia?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ficha_coaching_cliente_telefone_fkey"
            columns: ["cliente_telefone"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["telefone"]
          },
          {
            foreignKeyName: "ficha_coaching_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_grupo_membros: {
        Row: {
          adicionado_em: string
          adicionado_por: string | null
          ficha_id: string
          grupo_id: string
          id: string
          papel: string
        }
        Insert: {
          adicionado_em?: string
          adicionado_por?: string | null
          ficha_id: string
          grupo_id: string
          id?: string
          papel?: string
        }
        Update: {
          adicionado_em?: string
          adicionado_por?: string | null
          ficha_id?: string
          grupo_id?: string
          id?: string
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficha_grupo_membros_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: true
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "ficha_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_grupos: {
        Row: {
          criado_em: string
          criado_por: string | null
          ficha_principal_id: string
          id: string
          motivo: string | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          ficha_principal_id: string
          id?: string
          motivo?: string | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          ficha_principal_id?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ficha_grupos_ficha_principal_id_fkey"
            columns: ["ficha_principal_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
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
          hora_fim_prestador_agendamento: string | null
          hora_fim_prestador_retorno: string | null
          hora_fim_retorno: string | null
          hora_inicio_agendamento: string | null
          hora_inicio_prestador_agendamento: string | null
          hora_inicio_prestador_retorno: string | null
          hora_inicio_retorno: string | null
          horario_agendamento: string | null
          horario_visita_tecnica: string | null
          id: string
          id_zoho: string | null
          link_pagamento_envio_count: number
          link_pagamento_ultimo_envio_em: string | null
          link_pagamento_ultimo_envio_origem: string | null
          link_pagamento_ultimo_envio_por: string | null
          material_pago_24help: boolean | null
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
          recibo_enviado: boolean | null
          recibo_enviado_em: string | null
          recibo_envio_count: number
          recibo_ultimo_envio_origem: string | null
          recibo_ultimo_envio_por: string | null
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
          hora_fim_prestador_agendamento?: string | null
          hora_fim_prestador_retorno?: string | null
          hora_fim_retorno?: string | null
          hora_inicio_agendamento?: string | null
          hora_inicio_prestador_agendamento?: string | null
          hora_inicio_prestador_retorno?: string | null
          hora_inicio_retorno?: string | null
          horario_agendamento?: string | null
          horario_visita_tecnica?: string | null
          id: string
          id_zoho?: string | null
          link_pagamento_envio_count?: number
          link_pagamento_ultimo_envio_em?: string | null
          link_pagamento_ultimo_envio_origem?: string | null
          link_pagamento_ultimo_envio_por?: string | null
          material_pago_24help?: boolean | null
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
          recibo_enviado?: boolean | null
          recibo_enviado_em?: string | null
          recibo_envio_count?: number
          recibo_ultimo_envio_origem?: string | null
          recibo_ultimo_envio_por?: string | null
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
          hora_fim_prestador_agendamento?: string | null
          hora_fim_prestador_retorno?: string | null
          hora_fim_retorno?: string | null
          hora_inicio_agendamento?: string | null
          hora_inicio_prestador_agendamento?: string | null
          hora_inicio_prestador_retorno?: string | null
          hora_inicio_retorno?: string | null
          horario_agendamento?: string | null
          horario_visita_tecnica?: string | null
          id?: string
          id_zoho?: string | null
          link_pagamento_envio_count?: number
          link_pagamento_ultimo_envio_em?: string | null
          link_pagamento_ultimo_envio_origem?: string | null
          link_pagamento_ultimo_envio_por?: string | null
          material_pago_24help?: boolean | null
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
          recibo_enviado?: boolean | null
          recibo_enviado_em?: string | null
          recibo_envio_count?: number
          recibo_ultimo_envio_origem?: string | null
          recibo_ultimo_envio_por?: string | null
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
      horario_saida_previsto: {
        Row: {
          hora_saida: string
          id: string
          lembrete_minutos_antes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          hora_saida?: string
          id?: string
          lembrete_minutos_antes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          hora_saida?: string
          id?: string
          lembrete_minutos_antes?: number
          updated_at?: string | null
          user_id?: string
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
      mensagem_leitura_operador: {
        Row: {
          cliente_telefone: string
          id: string
          last_read_at: string | null
          manual_unread: boolean
          manual_unread_at: string | null
          user_id: string
        }
        Insert: {
          cliente_telefone: string
          id?: string
          last_read_at?: string | null
          manual_unread?: boolean
          manual_unread_at?: string | null
          user_id: string
        }
        Update: {
          cliente_telefone?: string
          id?: string
          last_read_at?: string | null
          manual_unread?: boolean
          manual_unread_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          arquivo_url: string | null
          cliente_id: string
          conversation_id: string | null
          data_hora: string | null
          enviado_por_id: string | null
          ficha_id: string | null
          id: string
          message_sid: string | null
          numero_twilio: string | null
          operador_nome: string | null
          remetente: string
          reply_to_message_id: string | null
          status: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          tipo_remetente: string | null
          transcricao_texto: string | null
        }
        Insert: {
          arquivo_url?: string | null
          cliente_id: string
          conversation_id?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          message_sid?: string | null
          numero_twilio?: string | null
          operador_nome?: string | null
          remetente: string
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          tipo_remetente?: string | null
          transcricao_texto?: string | null
        }
        Update: {
          arquivo_url?: string | null
          cliente_id?: string
          conversation_id?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          message_sid?: string | null
          numero_twilio?: string | null
          operador_nome?: string | null
          remetente?: string
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          tipo_remetente?: string | null
          transcricao_texto?: string | null
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
      mensagens_backup: {
        Row: {
          arquivo_url: string | null
          cliente_id: string | null
          data_hora: string | null
          enviado_por_id: string | null
          ficha_id: string | null
          id: string | null
          message_sid: string | null
          numero_twilio: string | null
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
          numero_twilio?: string | null
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
          numero_twilio?: string | null
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
      mensagens_backup_teste: {
        Row: {
          arquivo_url: string | null
          cliente_id: string | null
          conversation_id: string | null
          data_hora: string | null
          enviado_por_id: string | null
          ficha_id: string | null
          id: string | null
          message_sid: string | null
          numero_twilio: string | null
          operador_nome: string | null
          remetente: string | null
          reply_to_message_id: string | null
          status: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          tipo_remetente: string | null
        }
        Insert: {
          arquivo_url?: string | null
          cliente_id?: string | null
          conversation_id?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string | null
          message_sid?: string | null
          numero_twilio?: string | null
          operador_nome?: string | null
          remetente?: string | null
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          tipo_remetente?: string | null
        }
        Update: {
          arquivo_url?: string | null
          cliente_id?: string | null
          conversation_id?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string | null
          message_sid?: string | null
          numero_twilio?: string | null
          operador_nome?: string | null
          remetente?: string | null
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          status_atualizado_em?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          tipo_remetente?: string | null
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
      mensagens_prestadores: {
        Row: {
          arquivo_url: string | null
          data_hora: string | null
          enviado_por_id: string | null
          ficha_id: string | null
          id: string
          message_sid: string | null
          numero_twilio: string | null
          prestador_telefone: string
          remetente: string
          reply_to_message_id: string | null
          status: Database["public"]["Enums"]["status_mensagem_enum"] | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          transcricao_texto: string | null
        }
        Insert: {
          arquivo_url?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          message_sid?: string | null
          numero_twilio?: string | null
          prestador_telefone: string
          remetente: string
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          transcricao_texto?: string | null
        }
        Update: {
          arquivo_url?: string | null
          data_hora?: string | null
          enviado_por_id?: string | null
          ficha_id?: string | null
          id?: string
          message_sid?: string | null
          numero_twilio?: string | null
          prestador_telefone?: string
          remetente?: string
          reply_to_message_id?: string | null
          status?: Database["public"]["Enums"]["status_mensagem_enum"] | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mensagem_enum"] | null
          transcricao_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_prestadores_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_prestadores_prestador_telefone_fkey"
            columns: ["prestador_telefone"]
            isOneToOne: false
            referencedRelation: "prestadores_chat"
            referencedColumns: ["telefone"]
          },
        ]
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
      pagamento_webhook_log: {
        Row: {
          auth_source: string | null
          created_at: string
          direcao: string
          duracao_ms: number | null
          erro: string | null
          evento: string | null
          ficha_id: string | null
          id: string
          origem: string
          pagamento_link: string | null
          payload: Json | null
          resposta: Json | null
          status: string
          valor: number | null
        }
        Insert: {
          auth_source?: string | null
          created_at?: string
          direcao: string
          duracao_ms?: number | null
          erro?: string | null
          evento?: string | null
          ficha_id?: string | null
          id?: string
          origem: string
          pagamento_link?: string | null
          payload?: Json | null
          resposta?: Json | null
          status?: string
          valor?: number | null
        }
        Update: {
          auth_source?: string | null
          created_at?: string
          direcao?: string
          duracao_ms?: number | null
          erro?: string | null
          evento?: string | null
          ficha_id?: string | null
          id?: string
          origem?: string
          pagamento_link?: string | null
          payload?: Json | null
          resposta?: Json | null
          status?: string
          valor?: number | null
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
          agencia: string | null
          ativo: boolean
          banco: string | null
          categoria: string | null
          cep: string | null
          chave_pix: string | null
          cnpj: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string | null
          email: string | null
          endereco: string | null
          especialidade: string | null
          id_azure: string | null
          id_crm: string | null
          nome: string
          nome_pix: string | null
          regiao_atuacao: string | null
          taxa_visita_padrao: number | null
          telefone: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          categoria?: string | null
          cep?: string | null
          chave_pix?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta?: string | null
          cpf: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          especialidade?: string | null
          id_azure?: string | null
          id_crm?: string | null
          nome: string
          nome_pix?: string | null
          regiao_atuacao?: string | null
          taxa_visita_padrao?: number | null
          telefone: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          categoria?: string | null
          cep?: string | null
          chave_pix?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          especialidade?: string | null
          id_azure?: string | null
          id_crm?: string | null
          nome?: string
          nome_pix?: string | null
          regiao_atuacao?: string | null
          taxa_visita_padrao?: number | null
          telefone?: string
        }
        Relationships: []
      }
      prestadores_chat: {
        Row: {
          arquivado: boolean | null
          cpf: string | null
          created_at: string | null
          marcado_nao_lido: boolean | null
          nome: string
          notas_internas: string | null
          numero_twilio: string | null
          status_conversa:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags: string[] | null
          telefone: string
          ultima_interacao: string | null
        }
        Insert: {
          arquivado?: boolean | null
          cpf?: string | null
          created_at?: string | null
          marcado_nao_lido?: boolean | null
          nome?: string
          notas_internas?: string | null
          numero_twilio?: string | null
          status_conversa?:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags?: string[] | null
          telefone: string
          ultima_interacao?: string | null
        }
        Update: {
          arquivado?: boolean | null
          cpf?: string | null
          created_at?: string | null
          marcado_nao_lido?: boolean | null
          nome?: string
          notas_internas?: string | null
          numero_twilio?: string | null
          status_conversa?:
            | Database["public"]["Enums"]["status_conversa_enum"]
            | null
          tags?: string[] | null
          telefone?: string
          ultima_interacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestadores_chat_cpf_fkey"
            columns: ["cpf"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["cpf"]
          },
        ]
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
      registro_ponto: {
        Row: {
          created_at: string
          entrada_em: string
          entrada_oficial: string | null
          id: string
          observacao: string | null
          saida_em: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entrada_em?: string
          entrada_oficial?: string | null
          id?: string
          observacao?: string | null
          saida_em?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entrada_em?: string
          entrada_oficial?: string | null
          id?: string
          observacao?: string | null
          saida_em?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          categoria: string
          cliente_telefone: string | null
          created_at: string
          detalhes: Json | null
          ficha_id: string | null
          id: string
          mensagem: string
          nivel: string
          url: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          categoria?: string
          cliente_telefone?: string | null
          created_at?: string
          detalhes?: Json | null
          ficha_id?: string | null
          id?: string
          mensagem: string
          nivel?: string
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          categoria?: string
          cliente_telefone?: string | null
          created_at?: string
          detalhes?: Json | null
          ficha_id?: string | null
          id?: string
          mensagem?: string
          nivel?: string
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
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
      tarefas_operacionais: {
        Row: {
          cliente_telefone: string | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          ficha_id: string | null
          id: string
          prazo: string | null
          resolvido_em: string | null
          resolvido_nota: string | null
          status: string
          tipo: string
          titulo: string
          tolerancia_aviso_minutos: number | null
          ultimo_aviso_em: string | null
          updated_at: string | null
          urgencia: string
        }
        Insert: {
          cliente_telefone?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          ficha_id?: string | null
          id?: string
          prazo?: string | null
          resolvido_em?: string | null
          resolvido_nota?: string | null
          status?: string
          tipo?: string
          titulo: string
          tolerancia_aviso_minutos?: number | null
          ultimo_aviso_em?: string | null
          updated_at?: string | null
          urgencia?: string
        }
        Update: {
          cliente_telefone?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          ficha_id?: string | null
          id?: string
          prazo?: string | null
          resolvido_em?: string | null
          resolvido_nota?: string | null
          status?: string
          tipo?: string
          titulo?: string
          tolerancia_aviso_minutos?: number | null
          ultimo_aviso_em?: string | null
          updated_at?: string | null
          urgencia?: string
        }
        Relationships: []
      }
      tarefas_operacionais_atribuidos: {
        Row: {
          created_at: string | null
          id: string
          tarefa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tarefa_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tarefa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_operacionais_atribuidos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas_operacionais"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          task_id: string
          user_id: string
        }
        Insert: {
          task_id: string
          user_id: string
        }
        Update: {
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_visibility: {
        Row: {
          owner_id: string
          viewer_id: string
        }
        Insert: {
          owner_id: string
          viewer_id: string
        }
        Update: {
          owner_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_visibility_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_visibility_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          attachments: string[]
          category: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          last_comment: string | null
          priority: string
          progress: number
          project: string | null
          resolution_note: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: string[]
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          last_comment?: string | null
          priority?: string
          progress?: number
          project?: string | null
          resolution_note?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: string[]
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          last_comment?: string | null
          priority?: string
          progress?: number
          project?: string | null
          resolution_note?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          name: string
          role: string
        }
        Insert: {
          id: string
          name: string
          role?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          ficha_troca_ref: string | null
          forma_pagamento_cliente: string | null
          id: string
          justificativa_troca: string | null
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
          tipo_troca: string | null
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
          ficha_troca_ref?: string | null
          forma_pagamento_cliente?: string | null
          id?: string
          justificativa_troca?: string | null
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
          tipo_troca?: string | null
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
          ficha_troca_ref?: string | null
          forma_pagamento_cliente?: string | null
          id?: string
          justificativa_troca?: string | null
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
          tipo_troca?: string | null
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
      twilio_reconciliation_runs: {
        Row: {
          created_at: string
          customer_phone: string | null
          duration_ms: number | null
          errors_details: Json
          id: string
          loss_rate_pct: number
          managed_numbers: string[] | null
          missing_details: Json
          period_end: string
          period_start: string
          recovery_details: Json
          scope: string
          total_extra: number
          total_lovable: number
          total_missing: number
          total_recovered: number
          total_recovery_errors: number
          total_twilio: number
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          duration_ms?: number | null
          errors_details?: Json
          id?: string
          loss_rate_pct?: number
          managed_numbers?: string[] | null
          missing_details?: Json
          period_end: string
          period_start: string
          recovery_details?: Json
          scope?: string
          total_extra?: number
          total_lovable?: number
          total_missing?: number
          total_recovered?: number
          total_recovery_errors?: number
          total_twilio?: number
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          duration_ms?: number | null
          errors_details?: Json
          id?: string
          loss_rate_pct?: number
          managed_numbers?: string[] | null
          missing_details?: Json
          period_end?: string
          period_start?: string
          recovery_details?: Json
          scope?: string
          total_extra?: number
          total_lovable?: number
          total_missing?: number
          total_recovered?: number
          total_recovery_errors?: number
          total_twilio?: number
          triggered_by?: string | null
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
      whatsapp_envios_rastreamento: {
        Row: {
          cliente_telefone: string | null
          conta_receber_id: string | null
          criado_em: string | null
          ficha_id: string | null
          id: string
          status: string | null
          template_sid: string | null
          tipo_envio: string | null
        }
        Insert: {
          cliente_telefone?: string | null
          conta_receber_id?: string | null
          criado_em?: string | null
          ficha_id?: string | null
          id?: string
          status?: string | null
          template_sid?: string | null
          tipo_envio?: string | null
        }
        Update: {
          cliente_telefone?: string | null
          conta_receber_id?: string | null
          criado_em?: string | null
          ficha_id?: string | null
          id?: string
          status?: string | null
          template_sid?: string | null
          tipo_envio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_envios_rastreamento_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          content_sid: string
          created_at: string
          desliga_bot: boolean
          disable_bot_on_send: boolean
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
          desliga_bot?: boolean
          disable_bot_on_send?: boolean
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
          desliga_bot?: boolean
          disable_bot_on_send?: boolean
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
      can_manage_avisos: { Args: { _user_id: string }; Returns: boolean }
      check_and_close_orcamento_forms: { Args: never; Returns: undefined }
      fichas_sem_nome_cliente_recentes: {
        Args: never
        Returns: {
          created_at: string
          id: string
          nome_cliente: string
          nome_ficha: string
          status: string
          telefone_cliente: string
        }[]
      }
      find_or_create_internal_conversation: {
        Args: { p_user1: string; p_user2: string }
        Returns: string
      }
      get_unread_cliente_msgs: {
        Args: { _read_map: Json; _telefones: string[] }
        Returns: {
          cliente_id: string
          total_nao_lidas: number
          ultima_data: string
        }[]
      }
      get_unread_state_for_user: {
        Args: { _telefones: string[] }
        Returns: {
          cliente_id: string
          is_unread: boolean
          last_read_at: string
          manual_unread: boolean
          total_nao_lidas: number
          ultima_data_cliente: string
        }[]
      }
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
      redistribute_chats_silent: {
        Args: { _target_user_id: string; _telefones: string[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user" | "supervisor" | "chefe" | "admin_ti"
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
      app_role: ["admin", "user", "supervisor", "chefe", "admin_ti"],
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
