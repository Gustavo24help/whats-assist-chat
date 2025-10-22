export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-md">
        <span className="text-primary-foreground font-bold text-xl">SS</span>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-foreground text-sm leading-tight">Sistema de</span>
        <span className="font-bold text-primary text-sm leading-tight">Serviços</span>
      </div>
    </div>
  );
};
