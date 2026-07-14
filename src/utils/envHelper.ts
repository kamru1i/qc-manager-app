import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  
  // Detect Tauri environment
  const isTauri = 
    "__TAURI_INTERNALS__" in window || 
    (window as any).__TAURI__ !== undefined;
    
  // Detect Capacitor native platform (iOS / Android)
  const isCapacitor = Capacitor.isNativePlatform();
  
  return isTauri || isCapacitor;
}
