'use client';

import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { sessionTexts } from '@/features/cleaning/session-texts';

const t = sessionTexts;

/** Encre bleu nuit de la charte, sur fond blanc (image lisible dans le back-office). */
const INK = '#0F2850';
const PAPER = '#FFFFFF';

/**
 * Signature du client sur le téléphone de l'agent (facultative) : tracé au doigt dans un `canvas`, sans
 * dépendance, exporté en PNG à chaque trait levé. L'image part avec la clôture (`signatureFileId`), déposée
 * au service file comme une photo. Sans `canvas` (navigateur ancien), l'écran le dit : on clôture sans.
 */
export function SignaturePad({
  id,
  onChange,
  disabled,
}: {
  id: string;
  onChange: (signature: Blob | null) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [signed, setSigned] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const context = () => canvasRef.current?.getContext('2d') ?? null;

  function paper(target: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.fillStyle = PAPER;
    target.fillRect(0, 0, canvas.width, canvas.height);
    target.restore();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const target = canvas?.getContext('2d') ?? null;
    if (!canvas || !target) {
      setUnavailable(true);
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round((box.width || 320) * ratio));
    canvas.height = Math.max(1, Math.round((box.height || 176) * ratio));
    target.scale(ratio, ratio);
    target.lineWidth = 2.5;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    target.strokeStyle = INK;
    paper(target, canvas);
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function exportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => onChange(blob), 'image/png');
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const target = context();
    if (disabled || !target) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture indisponible : le tracé suit quand même le doigt.
    }
    const at = point(event);
    last.current = at;
    target.beginPath();
    target.moveTo(at.x, at.y);
    target.lineTo(at.x + 0.01, at.y + 0.01);
    target.stroke();
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const target = context();
    if (!last.current || !target) return;
    const at = point(event);
    target.beginPath();
    target.moveTo(last.current.x, last.current.y);
    target.lineTo(at.x, at.y);
    target.stroke();
    last.current = at;
  }

  function end() {
    if (!last.current) return;
    last.current = null;
    setSigned(true);
    exportImage();
  }

  function clear() {
    const canvas = canvasRef.current;
    const target = context();
    if (canvas && target) paper(target, canvas);
    setSigned(false);
    onChange(null);
  }

  if (unavailable) return <p className="text-ink-muted">{t.signatureUnavailable}</p>;

  return (
    <div
      role="group"
      aria-labelledby={`${id}-libelle`}
      aria-describedby={`${id}-aide`}
      className="grid gap-2"
    >
      <p id={`${id}-libelle`} className="text-ink font-semibold">
        {t.signature}
      </p>
      <p id={`${id}-aide`} className="text-small text-ink-muted -mt-1">
        {t.signatureHint}
      </p>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={signed ? t.signatureSigned : t.signatureEmpty}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className="rounded-control border-line-strong h-44 w-full touch-none border-2 border-dashed bg-white"
      />
      <Button variant="ghost" onClick={clear} disabled={disabled || !signed} className="justify-self-start">
        {t.signatureClear}
      </Button>
    </div>
  );
}
