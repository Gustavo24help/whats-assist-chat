import { Check, Sun, Sparkles, Zap, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVisualMode, BackgroundMode, CardMode, AccentIntensity } from "@/contexts/VisualModeContext";
import { cn } from "@/lib/utils";

interface OptionItemProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  preview?: React.ReactNode;
  icon?: React.ReactNode;
}

const OptionItem = ({ label, isSelected, onClick, preview, icon }: OptionItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all",
      "hover:bg-muted/80",
      isSelected && "bg-brand-green/10"
    )}
  >
    <div className="flex-shrink-0">
      {preview || icon}
    </div>
    <span className={cn(
      "flex-1 text-left text-sm",
      isSelected && "font-medium text-brand-green"
    )}>
      {label}
    </span>
    {isSelected && (
      <Check className="h-4 w-4 text-brand-green flex-shrink-0" />
    )}
  </button>
);

const BackgroundPreview = ({ mode }: { mode: BackgroundMode }) => {
  const styles: Record<BackgroundMode, string> = {
    neutral: "bg-background border border-border",
    gradient: "bg-gradient-to-br from-brand-green/20 via-background to-brand-yellow/10 border border-brand-green/20",
    colored: "bg-brand-green/15 border border-brand-green/30",
  };

  return (
    <div className={cn("w-8 h-6 rounded", styles[mode])} />
  );
};

const CardPreview = ({ mode }: { mode: CardMode }) => {
  const styles: Record<CardMode, string> = {
    white: "bg-white border border-gray-200",
    tinted: "bg-brand-green/5 border border-brand-green/20",
    vibrant: "bg-gradient-to-br from-brand-green/20 to-brand-yellow/10 border border-brand-green/30",
  };

  return (
    <div className={cn("w-8 h-6 rounded shadow-sm", styles[mode])} />
  );
};

const IntensityIcon = ({ intensity }: { intensity: AccentIntensity }) => {
  const icons: Record<AccentIntensity, React.ReactNode> = {
    subtle: <Sun className="h-4 w-4 text-muted-foreground" />,
    medium: <Sparkles className="h-4 w-4 text-brand-yellow" />,
    bold: <Zap className="h-4 w-4 text-brand-coral" />,
  };

  return (
    <div className="w-8 h-6 flex items-center justify-center">
      {icons[intensity]}
    </div>
  );
};

export const VisualModeSelector = () => {
  const {
    backgroundMode,
    cardMode,
    accentIntensity,
    setBackgroundMode,
    setCardMode,
    setAccentIntensity,
  } = useVisualMode();

  const backgroundOptions: { mode: BackgroundMode; label: string }[] = [
    { mode: "neutral", label: "Neutro" },
    { mode: "gradient", label: "Gradiente" },
    { mode: "colored", label: "Colorido" },
  ];

  const cardOptions: { mode: CardMode; label: string }[] = [
    { mode: "white", label: "Branco" },
    { mode: "tinted", label: "Sutis" },
    { mode: "vibrant", label: "Vibrante" },
  ];

  const intensityOptions: { intensity: AccentIntensity; label: string }[] = [
    { intensity: "subtle", label: "Sutil" },
    { intensity: "medium", label: "Médio" },
    { intensity: "bold", label: "Bold" },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          <span className="hidden md:inline">Visual</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-4">
          {/* Background Section */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Fundo
            </p>
            <div className="space-y-0.5">
              {backgroundOptions.map(({ mode, label }) => (
                <OptionItem
                  key={mode}
                  label={label}
                  isSelected={backgroundMode === mode}
                  onClick={() => setBackgroundMode(mode)}
                  preview={<BackgroundPreview mode={mode} />}
                />
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Cards Section */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Cards
            </p>
            <div className="space-y-0.5">
              {cardOptions.map(({ mode, label }) => (
                <OptionItem
                  key={mode}
                  label={label}
                  isSelected={cardMode === mode}
                  onClick={() => setCardMode(mode)}
                  preview={<CardPreview mode={mode} />}
                />
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Intensity Section */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Intensidade
            </p>
            <div className="space-y-0.5">
              {intensityOptions.map(({ intensity, label }) => (
                <OptionItem
                  key={intensity}
                  label={label}
                  isSelected={accentIntensity === intensity}
                  onClick={() => setAccentIntensity(intensity)}
                  preview={<IntensityIcon intensity={intensity} />}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
