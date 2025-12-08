import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Evento global para coordenar playback entre múltiplos AudioPlayers
const STOP_ALL_AUDIO_EVENT = 'stopAllAudio';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export const AudioPlayer = ({ src, className }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Listener para parar quando outro áudio começar a tocar
  useEffect(() => {
    const handleStopAll = (e: CustomEvent) => {
      const audio = audioRef.current;
      if (audio && e.detail?.except !== audio) {
        audio.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener(STOP_ALL_AUDIO_EVENT, handleStopAll as EventListener);
    return () => {
      window.removeEventListener(STOP_ALL_AUDIO_EVENT, handleStopAll as EventListener);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Dispara evento para parar todos os outros áudios
      window.dispatchEvent(new CustomEvent(STOP_ALL_AUDIO_EVENT, { 
        detail: { except: audio } 
      }));
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const percentage = x / bounds.width;
    audio.currentTime = percentage * duration;
  };

  const handleDownload = () => {
    try {
      setIsDownloading(true);
      
      // Criar elemento <a> para download
      const a = document.createElement('a');
      a.href = src;
      a.download = `audio_${Date.now()}.ogg`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("Download iniciado!");
    } catch (error) {
      console.error('Erro ao baixar áudio:', error);
      toast.error("Erro ao iniciar download");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-2 p-2 rounded-2xl bg-muted/30 min-w-[280px] max-w-[340px]", className)}>
      <audio ref={audioRef} src={src} />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-primary" />
        ) : (
          <Play className="h-4 w-4 text-primary ml-0.5" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        disabled={isDownloading}
        className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 shrink-0"
      >
        <Download className="h-4 w-4 text-primary" />
      </Button>

      <div className="flex-1 space-y-1">
        <div
          className="h-1 bg-muted-foreground/20 rounded-full cursor-pointer relative group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
