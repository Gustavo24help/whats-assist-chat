import { useEffect, useRef, useState, useCallback } from 'react';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; w: number; h: number;
  rotation: number; rotSpeed: number;
}

interface Props {
  active: boolean;
  message: string;
  onComplete: () => void;
}

const COLORS = ['#FFD700', '#FF6B6B', '#00FF88', '#00D4FF', '#FF69B4', '#FFA500', '#9B59B6', '#FFFFFF'];

export function TVCelebration({ active, message, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    for (let i = 0; i < 250; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height * 0.5 - 50,
        vx: (Math.random() - 0.5) * 10,
        vy: Math.random() * 4 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
      });
    }

    let frame = 0;
    const maxFrames = 300;
    let animId: number;

    const animate = () => {
      if (frame >= maxFrames) {
        setVisible(false);
        onCompleteRef.current();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gold flash for first ~2 seconds
      if (frame < 120) {
        const opacity = frame < 20 ? (frame / 20) * 0.25 : Math.max(0, 0.25 * (1 - (frame - 20) / 100));
        ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      particles.forEach(p => {
        p.x += p.vx;
        p.vy += 0.08;
        p.y += p.vy;
        p.vx *= 0.995;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      frame++;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const cleanup = startAnimation();
    return cleanup;
  }, [active, startAnimation]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-bounce">
          <div className="text-center">
            <div className="text-7xl drop-shadow-[0_0_40px_rgba(255,215,0,0.8)]">🏆</div>
            <div
              className="text-4xl font-black mt-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500"
              style={{ textShadow: '0 0 40px rgba(255,215,0,0.5)' }}
            >
              {message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
