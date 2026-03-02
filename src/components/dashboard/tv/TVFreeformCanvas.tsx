import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useTVFreeform, TVWidgetLayout } from '@/contexts/TVFreeformContext';
import { cn } from '@/lib/utils';

const SNAP_SIZE = 10;
const MIN_W = 100;
const MIN_H = 60;

type HandleType = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function snap(v: number, enabled: boolean): number {
  return enabled ? Math.round(v / SNAP_SIZE) * SNAP_SIZE : v;
}

interface WidgetWrapperProps {
  widget: TVWidgetLayout;
  children: React.ReactNode;
  canvasScale: number;
}

function WidgetWrapper({ widget, children, canvasScale }: WidgetWrapperProps) {
  const { isEditing, selectedId, setSelectedId, updateWidget, snapEnabled, bringToFront } = useTVFreeform();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ handle: HandleType; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; locked: boolean } | null>(null);

  const handleMouseDownMove = useCallback((e: React.MouseEvent) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(widget.id);
    bringToFront(widget.id);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.x,
      origY: widget.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / canvasScale;
      const dy = (ev.clientY - dragRef.current.startY) / canvasScale;
      updateWidget(widget.id, {
        x: snap(dragRef.current.origX + dx, snapEnabled),
        y: snap(dragRef.current.origY + dy, snapEnabled),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isEditing, widget.id, widget.x, widget.y, canvasScale, snapEnabled, updateWidget, setSelectedId, bringToFront]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent, handle: HandleType) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(widget.id);
    const isShift = e.shiftKey;
    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.x,
      origY: widget.y,
      origW: widget.width,
      origH: widget.height,
      locked: isShift || widget.locked,
    };

    const aspect = widget.width / widget.height;

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const dx = (ev.clientX - r.startX) / canvasScale;
      const dy = (ev.clientY - r.startY) / canvasScale;
      const lockRatio = ev.shiftKey || widget.locked;

      let newX = r.origX, newY = r.origY, newW = r.origW, newH = r.origH;

      // Width changes
      if (handle.includes('e')) newW = Math.max(MIN_W, r.origW + dx);
      if (handle.includes('w')) { newW = Math.max(MIN_W, r.origW - dx); newX = r.origX + r.origW - newW; }
      // Height changes
      if (handle.includes('s')) newH = Math.max(MIN_H, r.origH + dy);
      if (handle.includes('n')) { newH = Math.max(MIN_H, r.origH - dy); newY = r.origY + r.origH - newH; }

      // Lock aspect ratio on corners
      if (lockRatio && (handle.length === 2)) {
        const newAspect = newW / newH;
        if (newAspect > aspect) {
          newW = newH * aspect;
        } else {
          newH = newW / aspect;
        }
      }

      updateWidget(widget.id, {
        x: snap(newX, snapEnabled),
        y: snap(newY, snapEnabled),
        width: snap(newW, snapEnabled),
        height: snap(newH, snapEnabled),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isEditing, widget, canvasScale, snapEnabled, updateWidget, setSelectedId]);

  const isSelected = selectedId === widget.id;
  const handles: { type: HandleType; className: string; cursor: string }[] = [
    { type: 'nw', className: '-top-1 -left-1', cursor: 'nwse-resize' },
    { type: 'n',  className: '-top-1 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
    { type: 'ne', className: '-top-1 -right-1', cursor: 'nesw-resize' },
    { type: 'e',  className: 'top-1/2 -right-1 -translate-y-1/2', cursor: 'ew-resize' },
    { type: 'se', className: '-bottom-1 -right-1', cursor: 'nwse-resize' },
    { type: 's',  className: '-bottom-1 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
    { type: 'sw', className: '-bottom-1 -left-1', cursor: 'nesw-resize' },
    { type: 'w',  className: 'top-1/2 -left-1 -translate-y-1/2', cursor: 'ew-resize' },
  ];

  return (
    <div
      className={cn(
        'absolute overflow-hidden transition-shadow',
        isEditing && 'hover:ring-1 hover:ring-cyan-500/40',
        isEditing && isSelected && 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(0,212,255,0.3)]',
      )}
      style={{
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.autoHeight ? 'auto' : widget.height,
        zIndex: widget.zIndex,
        cursor: isEditing ? 'move' : 'default',
      }}
      onMouseDown={handleMouseDownMove}
      onClick={(e) => { if (isEditing) { e.stopPropagation(); setSelectedId(widget.id); } }}
    >
      {/* Scale mode indicator */}
      {isEditing && (
        <div className="absolute top-1 right-1 z-10 text-[8px] px-1 py-0.5 rounded bg-gray-900/80 text-gray-400 pointer-events-none">
          {widget.scaleMode === 'fixed' ? '📌 px' : '📐 %'}
        </div>
      )}

      {/* Content */}
      <div className="w-full h-full">{children}</div>

      {/* Resize handles */}
      {isEditing && isSelected && handles.map(h => (
        <div
          key={h.type}
          className={cn('absolute w-3 h-3 bg-cyan-400 border border-cyan-200 rounded-sm z-20', h.className)}
          style={{ cursor: h.cursor }}
          onMouseDown={(e) => handleMouseDownResize(e, h.type)}
        />
      ))}

      {/* Edge resize zones (invisible wider hit areas) */}
      {isEditing && isSelected && (
        <>
          <div className="absolute -top-2 left-3 right-3 h-4 cursor-ns-resize z-10" onMouseDown={e => handleMouseDownResize(e, 'n')} />
          <div className="absolute -bottom-2 left-3 right-3 h-4 cursor-ns-resize z-10" onMouseDown={e => handleMouseDownResize(e, 's')} />
          <div className="absolute top-3 -left-2 w-4 bottom-3 cursor-ew-resize z-10" onMouseDown={e => handleMouseDownResize(e, 'w')} />
          <div className="absolute top-3 -right-2 w-4 bottom-3 cursor-ew-resize z-10" onMouseDown={e => handleMouseDownResize(e, 'e')} />
        </>
      )}
    </div>
  );
}

interface TVFreeformCanvasProps {
  renderBlock: (blockId: string) => React.ReactNode;
}

export function TVFreeformCanvas({ renderBlock }: TVFreeformCanvasProps) {
  const { widgets, isEditing, setSelectedId, canvasWidth, canvasHeight } = useTVFreeform();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.clientWidth;
      setCanvasScale(containerW / canvasWidth);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [canvasWidth]);

  const enabledWidgets = widgets.filter(w => w.enabled);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ paddingBottom: `${(canvasHeight / canvasWidth) * 100}%` }}
      onClick={() => { if (isEditing) setSelectedId(null); }}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `scale(${canvasScale})`, width: canvasWidth, height: canvasHeight }}
      >
        {/* Grid overlay in edit mode */}
        {isEditing && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        )}

        {enabledWidgets.map(widget => (
          <WidgetWrapper key={widget.id} widget={widget} canvasScale={canvasScale}>
            {renderBlock(widget.id)}
          </WidgetWrapper>
        ))}
      </div>
    </div>
  );
}
