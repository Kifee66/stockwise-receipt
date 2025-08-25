import { useEffect, useRef, useState } from "react";

export function useBarcodeScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, []);

  // Placeholder: Simulates future barcode scanning integration
  function start() {
    setIsScanning(true);
    // Coming soon: integrate with camera and decoding library
    // For now, we leave a no-op with a friendly message hook
  }

  function stop() {
    setIsScanning(false);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }

  return { isScanning, lastScanned, setLastScanned, start, stop, message: "Barcode scanning coming soon" };
}
