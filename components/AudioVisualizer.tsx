'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  data: number[];
}

export function AudioVisualizer({ data }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const barWidth = rect.width / data.length;
    const baseHeight = rect.height / 2;

    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.beginPath();
    ctx.moveTo(0, baseHeight);

    for (let i = 0; i < data.length; i++) {
      const x = i * barWidth;
      const height = data[i] * baseHeight;
      ctx.lineTo(x, baseHeight - height);
    }

    for (let i = data.length - 1; i >= 0; i--) {
      const x = i * barWidth;
      const height = data[i] * baseHeight;
      ctx.lineTo(x, baseHeight + height);
    }

    ctx.closePath();
    ctx.fill();

    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.5, 'blue');
    gradient.addColorStop(1, 'green');
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'w-full h-full rounded-lg',
        'transition-opacity duration-300'
      )}
    />
  );
}
