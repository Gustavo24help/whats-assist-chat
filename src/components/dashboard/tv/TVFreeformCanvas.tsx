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

type GuideLine = { orientation: 'vertical' | 'horizontal'; position: number };

interface WidgetWrapperProps {
  widget: TVWidgetLayout;
  children: React.ReactNode;
  canvasScale: number;
  widgets: TVWidgetLayout[];
  setGuides: React.Dispatch<React.SetStateAction<GuideLine[]>>;
}

function WidgetWrapper({ widget, children, canvasScale, widgets, setGuides }: WidgetWrapperProps) {
  const { isEditing, selectedId, setSelectedId, updateWidget, snapEnabled, bringToFront } = useTVFreeform();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ handle: HandleType; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; locked: boolean } | null>(null);

  const applyAlignment = useCallback((x: number, y: number, width = widget.width, height = widget.height) => {
    if (!isEditing) return { x, y };
    const threshold = 8;
    const vertical = [x, x + width / 2, x + width];
    const horizontal = [y, y + height / 2, y + height];
    let bestDx = 0;
    let bestDy = 0;
    let bestV = Infinity;
    let bestH = Infinity;
    const guides: GuideLine[] = [];

    widgets.filter(w => w.id !== widget.id && w.enabled).forEach(other => {
      const otherV = [other.x, other.x + other.width / 2, other.x + other.width];
      const otherH = [other.y, other.y + other.height / 2, other.y + other.height];

      vertical.forEach(v => {
        otherV.forEach(ov => {
          const delta = ov - v;
          if (Math.abs(delta) < Math.abs(bestDx) || bestV === Infinity) {
            if (Math.abs(delta) <= threshold) {
              bestDx = delta;
              bestV = Math.abs(delta);
              if (!guides.find(g => g.orientation === 'vertical' && g.position === ov)) guides.push({ orientation: 'vertical', position: ov });
            }
          }
        });
      });

      horizontal.forEach(h => {
        otherH.forEach(oh => {
          const delta = oh - h;
          if (Math.abs(delta) < Math.abs(bestDy) || bestH === Infinity) {
            if (Math.abs(delta) <= threshold) {
              bestDy = delta;
              bestH = Math.abs(delta);
              if (!guides.find(g => g.orientation === 'horizontal' && g.position === oh)) guides.push({ orientation: 'horizontal', position: oh });
            }
          }
        });
      });
    });

    setGuides(guides.slice(0, 2));
    return { x: x + bestDx, y: y + bestDy };
  }, [isEditing, widget.width, widget.height, widget.id, widgets, setGuides]);


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
      const nextX = dragRef.current.origX + dx;
      const nextY = dragRef.current.origY + dy;
      const aligned = applyAlignment(nextX, nextY);
      updateWidget(widget.id, {
        x: snap(aligned.x, snapEnabled),
        y: snap(aligned.y, snapEnabled),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      setGuides([]);
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

      const aligned = applyAlignment(newX, newY, newW, newH);
      updateWidget(widget.id, {
        x: snap(aligned.x, snapEnabled),
        y: snap(aligned.y, snapEnabled),
        width: snap(newW, snapEnabled),
        height: snap(newH, snapEnabled),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      setGuides([]);
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
        <div className="absolute top-1 right-1 z-10 text-[8px] px-1 py-0.5 rounded bg-white/80 text-[#6B7280] pointer-events-none">
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
  const [guides, setGuides] = useState<GuideLine[]>([]);

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
          <WidgetWrapper key={widget.id} widget={widget} canvasScale={canvasScale} widgets={enabledWidgets} setGuides={setGuides}>
            {renderBlock(widget.id)}
          </WidgetWrapper>
        ))}

        {isEditing && guides.map((guide, idx) => (
          <div
            key={`${guide.orientation}-${guide.position}-${idx}`}
            className="absolute pointer-events-none z-10 bg-cyan-300/70"
            style={guide.orientation === 'vertical'
              ? { left: guide.position, top: 0, bottom: 0, width: 1 }
              : { top: guide.position, left: 0, right: 0, height: 1 }}
          />
        ))}
      </div>
    </div>
  );
}
