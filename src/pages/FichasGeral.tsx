import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { FichasOverview } from "@/components/FichasOverview";

const FichasGeral = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="flex gap-2">
            <Button 
              variant={window.location.pathname === "/" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => navigate("/")}
            >
              Conversas
            </Button>
            <Button 
              variant={window.location.pathname === "/geral" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => navigate("/geral")}
            >
              Geral
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Configurações</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <FichasOverview />
      </div>
    </div>
  );
};

export default FichasGeral;
