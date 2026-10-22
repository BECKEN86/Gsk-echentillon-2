import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Camera, LoaderCircle, X } from 'lucide-react';
import { showToast } from '../../utils/toast';

interface QrScannerModalProps {
  onClose: () => void;
  onScan: (value: string) => void;
}

export function QrScannerModal({ onClose, onScan }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  onScanRef.current = onScan;

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    let disposed = false;

    const startScanner = async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current || undefined,
          (result, _scanError, scannerControls) => {
            if (!result || disposed) return;
            scannerControls.stop();
            controlsRef.current = null;
            onScanRef.current(result.getText().trim());
          }
        );

        if (disposed) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setIsStarting(false);
      } catch (scanError) {
        if (disposed) return;
        const message = scanError instanceof Error
          ? scanError.message
          : 'Impossible d’accéder à la caméra.';
        setError(message);
        setIsStarting(false);
        showToast('Impossible de démarrer le scanner QR. Vérifiez l’accès à la caméra.', 'error');
      }
    };

    void startScanner();
    return () => {
      disposed = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001F3F] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-cyan-300" />
            <h2 className="text-base font-bold">Scanner un QR code produit</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer le scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {!error && (
              <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-cyan-300 shadow-[0_0_0_999px_rgba(15,23,42,0.28)]" />
            )}
            {isStarting && !error && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/60 text-sm font-semibold text-white">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Démarrage de la caméra…
              </div>
            )}
            {error && (
              <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-medium text-white">
                {error}
              </div>
            )}
          </div>
          <p className="text-center text-xs text-slate-500">
            Placez le QR code du produit dans le cadre. La recherche sera remplie automatiquement.
          </p>
          {error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              Autorisez l’accès à la caméra dans le navigateur. Vous pouvez aussi utiliser un lecteur QR externe : son code sera saisi directement dans la recherche.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
