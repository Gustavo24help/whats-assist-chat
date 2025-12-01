import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Component stack:", errorInfo.componentStack);
    console.error("Current URL:", window.location.href);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // Preservar os parâmetros da URL ao recarregar
    const currentUrl = window.location.href;
    window.location.href = currentUrl;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex items-center justify-center">
                <div className="rounded-full bg-amber-500/10 p-6">
                  <AlertTriangle className="h-12 w-12 text-amber-500" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  Ops! Algo deu errado
                </h2>
                <p className="text-muted-foreground text-sm">
                  {this.props.fallbackMessage || "Ocorreu um erro ao carregar a página. Por favor, tente novamente."}
                </p>
              </div>

              <Button 
                onClick={this.handleRetry}
                className="w-full h-12"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
