"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<boolean>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function isStandaloneDisplayMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const displayModeTimer = window.setTimeout(() => setIsInstalled(isStandaloneDisplayMode()), 0);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    const handleDisplayModeChange = () => setIsInstalled(isStandaloneDisplayMode());
    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.clearTimeout(displayModeTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setIsInstalled(true);
    return choice.outcome === "accepted";
  }, [installPrompt]);

  const value = useMemo(
    () => ({ canInstall: installPrompt !== null, isInstalled, install }),
    [install, installPrompt, isInstalled],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  return context ?? {
    canInstall: false,
    isInstalled: false,
    install: async () => false,
  };
}

export function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const serviceWorkerUrl = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?mode=dev";
    const registrationTimer = window.setTimeout(() => {
      void navigator.serviceWorker
        .register(serviceWorkerUrl, { updateViaCache: "none" })
        .then(async (registration) => {
          await navigator.serviceWorker.ready;
          const worker = navigator.serviceWorker.controller ?? registration.active;
          if (!worker) return;

          const sameOriginResources = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => url.startsWith(window.location.origin));

          worker.postMessage({
            type: "CACHE_URLS",
            urls: [window.location.href, ...sameOriginResources],
          });
        })
        .catch(() => {
          // The shell remains usable when a browser blocks service-worker registration.
        });
    }, 0);

    return () => window.clearTimeout(registrationTimer);
  }, []);

  return null;
}
