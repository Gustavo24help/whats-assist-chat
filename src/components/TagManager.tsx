import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

interface TagManagerProps {
  clienteTelefone: string;
  currentTags: string[];
  onTagsUpdate: () => void;
}

export const TagManager = ({ clienteTelefone, currentTags, onTagsUpdate }: TagManagerProps) => {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const addTag = async () => {
    if (!newTagName.trim()) return;
    
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
      addTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <TagIcon className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite o nome da tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={addTag} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
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
