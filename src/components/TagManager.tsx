import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TagManagerProps {
  clienteTelefone: string;
  currentTags: string[];
  onTagsUpdate: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TagManager = ({ clienteTelefone, currentTags, onTagsUpdate, open, onOpenChange }: TagManagerProps) => {
  const [newTagName, setNewTagName] = useState("");
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [selectedExistingTag, setSelectedExistingTag] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchExistingTags();
    }
  }, [open]);

  const fetchExistingTags = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('tags');

    if (data) {
      const allTags = new Set<string>();
      data.forEach((cliente: any) => {
        if (cliente.tags && Array.isArray(cliente.tags)) {
          cliente.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      setExistingTags(Array.from(allTags).sort());
    }
  };

  const addNewTag = async () => {
    if (!newTagName.trim()) return;
    if (currentTags.includes(newTagName.trim())) {
      toast.error("Tag já existe");
      return;
    }
    
    const updatedTags = [...currentTags, newTagName.trim()];
    
    const { error } = await supabase
      .from('clientes')
      .update({ tags: updatedTags })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error("Erro ao adicionar tag");
    } else {
      toast.success("Tag adicionada");
      setNewTagName("");
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
  const availableTags = existingTags.filter(tag => !currentTags.includes(tag));

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
                      <SelectItem key={tag} value={tag}>
                        {tag}
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
            <div className="flex gap-2">
              <Input
                placeholder="Digite o nome da tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button onClick={addNewTag} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Tags atuais:</p>
            {currentTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag atribuída</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-sm gap-1">
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
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
