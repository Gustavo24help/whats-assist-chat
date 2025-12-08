import { useState, useRef } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export const AudioRecorder = ({ onRecordingComplete, disabled }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Usar formato padrão do navegador - a conversão será feita no ChatWindow
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      console.log('🎤 Gravando em formato:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.start(100); // Coletar dados a cada 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer visual
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopAndSend = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    
    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onRecordingComplete(blob);
      cleanup();
    };
    
    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        cleanup();
      };
      mediaRecorderRef.current.stop();
    } else {
      cleanup();
    }
  };

  const cleanup = () => {
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-full animate-in fade-in slide-in-from-left-2">
        <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
        <span className="text-sm font-medium text-destructive min-w-[40px]">
          {formatTime(recordingTime)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Cancelar gravação"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={stopAndSend}
          className="h-8 w-8 bg-primary hover:bg-primary/90"
          title="Enviar áudio"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={startRecording}
      disabled={disabled}
      className="shrink-0 h-9 w-9 md:h-10 md:w-10"
      title="Gravar áudio"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};
