import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  logo?: string;
  className?: string;
  children?: ReactNode;
}

export const SectionHeader = ({
  title,
  subtitle,
  icon,
  logo,
  className,
  children,
}: SectionHeaderProps) => {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="flex items-center gap-3">
        {logo && (
          <img src={logo} alt="" className="h-8 w-auto" />
        )}
        {icon && !logo && (
          <div className="icon-container brand-green">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-foreground font-jakarta">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
};
