// One-shot confetti explosion. Appends a fixed full-screen canvas, fires a
// short burst of particles, then removes itself. No dependencies, no state
// held between shots. Safe to call repeatedly (each call spawns its own canvas).
const COLORS = ['#5cb3e6', '#a7ddf3', '#f5a623', '#4caf72', '#e0728a', '#e0b04a', '#9b8cf2'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  color: string;
  size: number;
  shape: 'rect' | 'circle';
}

export function confetti(count = 140): void {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  // Burst from the top-center, fanning outward and downward.
  const ox = W / 2;
  const oy = H * 0.28;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const sp = 7 + Math.random() * 11;
    particles.push({
      x: ox + (Math.random() - 0.5) * 60,
      y: oy + (Math.random() - 0.5) * 24,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.35,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      size: 6 + Math.random() * 6,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }

  const gravity = 0.32;
  const drag = 0.99;
  let frame = 0;
  const maxFrames = 150; // ~2.5s at 60fps, capped so it always cleans up

  function tick() {
    ctx!.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of particles) {
      if (p.y > H + 40) continue;
      alive++;
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
    }
    frame++;
    if (alive > 0 && frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}
