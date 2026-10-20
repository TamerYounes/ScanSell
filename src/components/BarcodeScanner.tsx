"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

/**
 * Opens the back camera and reads UPC/EAN and other common barcodes.
 * Calls onScan once with the first code it reads, then stops the camera.
 */
export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without restarting the camera on every render.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't use the camera. Type the barcode instead.");
        return;
      }

      // Loaded on demand so the scanner code isn't in every page's bundle.
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls?.stop();
              onScanRef.current(result.getText());
            }
          },
        );

        if (cancelled) controls.stop();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, or type the barcode."
            : "Couldn't start the camera. Type the barcode instead.",
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink/95" role="dialog" aria-label="Scan barcode">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium">Point the camera at a barcode</p>
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm font-medium hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {error ? (
          <p className="max-w-xs px-6 text-center text-sm text-white">{error}</p>
        ) : (
          <>
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded border-2 border-white/80" />
          </>
        )}
      </div>
    </div>
  );
}
