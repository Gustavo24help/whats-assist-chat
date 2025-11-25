import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TagManagerProps {
  clienteTelefone: string;
  currentTags: string[];
  onTagsUpdate: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TagWithColor {
  nome: string;
  cor: string;
}

export const TagManager = ({ clienteTelefone, currentTags, onTagsUpdate, open, onOpenChange }: TagManagerProps) => {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6B7280");
  const [existingTags, setExistingTags] = useState<TagWithColor[]>([]);
  const [selectedExistingTag, setSelectedExistingTag] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchExistingTags();
    }
  }, [open]);

  const fetchExistingTags = async () => {
    const { data } = await supabase
      .from('tags')
      .select('nome, cor')
      .order('nome');

    if (data) {
      setExistingTags(data);
    }
  };

  const addNewTag = async () => {
    if (!newTagName.trim()) return;
    if (currentTags.includes(newTagName.trim())) {
      toast.error("Tag já existe neste cliente");
      return;
    }

    // Inserir ou atualizar tag na tabela tags
    const { error: tagError } = await supabase
      .from('tags')
      .upsert({ nome: newTagName.trim(), cor: newTagColor }, { onConflict: 'nome' });

    if (tagError) {
      toast.error("Erro ao criar tag");
      return;
    }
    
    const updatedTags = [...currentTags, newTagName.trim()];
    
    const { error } = await supabase
      .from('clientes')
      .update({ tags: updatedTags })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error("Erro ao adicionar tag ao cliente");
    } else {
      toast.success("Tag adicionada");
      setNewTagName("");
      setNewTagColor("#6B7280");
      fetchExistingTags();
      onTagsUpdate();
    }
  };

  const addExistingTag = async () => {
    if (!selectedExistingTag) return;
    if (currentTags.includes(selectedExistingTag)) {
      toast.error("Tag já atribuída a este cliente");
      return;
    }

    const updatedTags = [...currentTags, selectedExistingTag];
    
    const { error } = await supabase
      .from('clientes')
      .update({ tags: updatedTags })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error("Erro ao adicionar tag");
    } else {
      toast.success("Tag adicionada");
      setSelectedExistingTag("");
      onTagsUpdate();
    }
  };

  const removeTag = async (tagToRemove: string) => {
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    
    const { error } = await supabase
      .from('clientes')
      .update({ tags: updatedTags })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error("Erro ao remover tag");
    } else {
      toast.success("Tag removida");
      onTagsUpdate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewTag();
    }
  };

  // Filter out tags already assigned
  const availableTags = existingTags.filter(tag => !currentTags.includes(tag.nome));

  // Paleta de cores pré-definidas
  const colorPalette = [
    { name: "Cinza", value: "#6B7280" },
    { name: "Vermelho", value: "#EF4444" },
    { name: "Laranja", value: "#F97316" },
    { name: "Amarelo", value: "#EAB308" },
    { name: "Verde", value: "#22C55E" },
    { name: "Azul", value: "#3B82F6" },
    { name: "Roxo", value: "#8B5CF6" },
    { name: "Rosa", value: "#EC4899" }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selecionar tag existente:</p>
              <div className="flex gap-2">
                <Select value={selectedExistingTag} onValueChange={setSelectedExistingTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.nome} value={tag.nome}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border" 
                            style={{ backgroundColor: tag.cor }}
                          />
                          {tag.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addExistingTag} disabled={!selectedExistingTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Criar nova tag:</p>
            <div className="space-y-2">
              <Input
                placeholder="Digite o nome da tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Escolha uma cor:</p>
                <div className="flex flex-wrap gap-2">
                  {colorPalette.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewTagColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                        newTagColor === color.value ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-muted"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <Button onClick={addNewTag} className="w-full" disabled={!newTagName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Tag
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Tags atuais:</p>
            {currentTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag atribuída</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag, index) => {
                  const tagData = existingTags.find(t => t.nome === tag);
                  const tagColor = tagData?.cor || '#6B7280';
                  return (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="text-sm gap-1 border"
                      style={{
                        backgroundColor: tagColor,
                        borderColor: tagColor,
                        color: '#FFFFFF'
                      }}
                    >
                      {tag}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
