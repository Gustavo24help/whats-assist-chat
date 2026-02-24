

# Correcao da Pagina de Avisos

## Problemas identificados

1. **Tabelas nao existem no banco**: As tabelas `avisos` e `aviso_leituras` nunca foram criadas. Por isso, qualquer tentativa de publicar ou carregar avisos falha silenciosamente.
2. **Imagens apenas por URL**: Atualmente so aceita URL de imagem. O projeto ja possui um bucket de storage (`chat-files`) que pode ser reutilizado para upload direto de arquivos.

## Solucao

### 1. Criar as tabelas no banco de dados (migracao SQL)

```sql
-- Tabela de avisos
CREATE TABLE public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  imagem_url text,
  criado_por uuid REFERENCES auth.users(id),
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver avisos"
  ON public.avisos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins podem criar avisos"
  ON public.avisos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabela de leituras
CREATE TABLE public.aviso_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aviso_id, user_id)
);

ALTER TABLE public.aviso_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver suas leituras"
  ON public.aviso_leituras FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios podem marcar como lido"
  ON public.aviso_leituras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

Nota: A coluna `criado_por_nome` sera preenchida automaticamente no frontend usando o nome do perfil do usuario logado, evitando a necessidade de um trigger.

### 2. Criar bucket de storage para imagens de avisos

Criar um bucket `avisos-images` (publico) para armazenar as imagens enviadas pelos admins, com politicas de acesso adequadas.

### 3. Atualizar `src/pages/Avisos.tsx`

Alteracoes no componente:

- **Adicionar upload de imagem**: Substituir o campo de URL por um botao de upload + area de arrastar/colar (drag & drop e paste)
- **Preencher `criado_por_nome`**: Usar `userProfile.fullName` do AuthContext ao inserir o aviso
- **Upload para storage**: Fazer upload da imagem para o bucket `avisos-images` e obter a URL publica
- **Manter compatibilidade**: Continuar aceitando URL manual como alternativa (campo opcional)
- **Preview da imagem**: Mostrar preview da imagem selecionada antes de publicar
- **Suporte a colar imagem**: Detectar `onPaste` no textarea para capturar imagens do clipboard

### Fluxo de upload de imagem

1. Admin clica no botao "Anexar imagem" ou cola uma imagem no campo de conteudo
2. Imagem e enviada para o bucket `avisos-images` com nome unico (uuid)
3. URL publica e armazenada na coluna `imagem_url` do aviso
4. Preview aparece antes de publicar

## Detalhes tecnicos

### Upload de imagem (trecho do componente)

```typescript
const handleImageUpload = async (file: File) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  
  const { error } = await supabase.storage
    .from('avisos-images')
    .upload(fileName, file);
  
  if (error) {
    toast.error("Erro ao enviar imagem.");
    return;
  }
  
  const { data: urlData } = supabase.storage
    .from('avisos-images')
    .getPublicUrl(fileName);
  
  setNovaImagemUrl(urlData.publicUrl);
};
```

### Paste handler

```typescript
const handlePaste = (e: React.ClipboardEvent) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) handleImageUpload(file);
    }
  }
};
```

## Resumo de alteracoes

| Arquivo / Recurso | Alteracao | Impacto |
|---|---|---|
| Migracao SQL | Criar tabelas `avisos` e `aviso_leituras` com RLS | Publicacao e leitura de avisos funcionam |
| Migracao SQL | Criar bucket `avisos-images` com politicas | Upload de imagens funciona |
| `src/pages/Avisos.tsx` | Upload de imagem, paste, preview, preencher nome do criador | Experiencia completa de publicacao |

## Seguranca de dados

- Nenhum dado existente e modificado (tabelas sao novas)
- RLS garante que apenas admins criam avisos e cada usuario so ve suas proprias leituras
- Bucket publico para leitura (avisos sao visiveis a todos os autenticados), upload restrito a admins
