"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaWindow = Window & {
  __ARES_PATH_INSTALL_PROMPT__?: BeforeInstallPromptEvent | null;
  __ARES_PATH_INSTALL_PROMPT_LISTENERS__?: Set<() => void>;
  __ARES_PATH_INSTALL_CAPTURE_ATTACHED__?: boolean;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<boolean>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function browserWindow() {
  return typeof window === "undefined" ? null : window as PwaWindow;
}

function notifyInstallPromptListeners(target: PwaWindow) {
  target.__ARES_PATH_INSTALL_PROMPT_LISTENERS__?.forEach((listener) => listener());
}

function captureInstallPrompt(event: Event) {
  const target = browserWindow();
  if (!target) return;

  event.preventDefault();
  target.__ARES_PATH_INSTALL_PROMPT__ = event as BeforeInstallPromptEvent;
  notifyInstallPromptListeners(target);
}

function ensureInstallPromptCapture() {
  const target = browserWindow();
  if (!target) return null;

  target.__ARES_PATH_INSTALL_PROMPT_LISTENERS__ ??= new Set();
  if (!target.__ARES_PATH_INSTALL_CAPTURE_ATTACHED__) {
    target.addEventListener("beforeinstallprompt", captureInstallPrompt);
    target.__ARES_PATH_INSTALL_CAPTURE_ATTACHED__ = true;
  }

  return target;
}

function clearInstallPrompt() {
  const target = browserWindow();
  if (!target) return;

  target.__ARES_PATH_INSTALL_PROMPT__ = null;
  notifyInstallPromptListeners(target);
}

if (typeof window !== "undefined") {
  ensureInstallPromptCapture();
}

function isStandaloneDisplayMode() {
  const displayModeMatches = typeof window.matchMedia === "function"
    && window.matchMedia("(display-mode: standalone)").matches;
  return displayModeMatches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => ensureInstallPromptCapture()?.__ARES_PATH_INSTALL_PROMPT__ ?? null,
  );
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const target = ensureInstallPromptCapture();
    if (!target) return;

    const syncInstallPrompt = () => {
      setInstallPrompt(target.__ARES_PATH_INSTALL_PROMPT__ ?? null);
    };
    target.__ARES_PATH_INSTALL_PROMPT_LISTENERS__?.add(syncInstallPrompt);
    syncInstallPrompt();

    const displayModeTimer = window.setTimeout(() => setIsInstalled(isStandaloneDisplayMode()), 0);
    const handleInstalled = () => {
      clearInstallPrompt();
      setIsInstalled(true);
    };
    const handleDisplayModeChange = () => setIsInstalled(isStandaloneDisplayMode());
    const mediaQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)")
      : null;

    window.addEventListener("appinstalled", handleInstalled);
    mediaQuery?.addEventListener("change", handleDisplayModeChange);

    return () => {
      target.__ARES_PATH_INSTALL_PROMPT_LISTENERS__?.delete(syncInstallPrompt);
      window.clearTimeout(displayModeTimer);
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery?.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      clearInstallPrompt();
      if (choice.outcome === "accepted") setIsInstalled(true);
      return choice.outcome === "accepted";
    } catch {
      clearInstallPrompt();
      return false;
    }
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
