"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteMissionPack,
  importMissionPack,
  listMissionPacks,
  prepareMissionPack,
  saveMissionPack,
} from "../services/mission-pack-store";
import type { MissionPack, MissionPackInput } from "../types";

export type OfflinePackStatus = "idle" | "loading" | "saving" | "ready" | "error";

export function useOfflineMissions() {
  const [packs, setPacks] = useState<MissionPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [status, setStatus] = useState<OfflinePackStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Keep the first render deterministic for SSR/hydration; the browser state
  // is applied immediately after the client takes over.
  const [isOnline, setIsOnline] = useState(true);

  const reload = useCallback(async () => {
    setStatus("loading");
    setIsOnline(window.navigator.onLine);
    try {
      let nextPacks = await listMissionPacks();
      // A page restored from a service-worker response can race the first
      // IndexedDB read. Retry once so a saved pack is not mistaken for an
      // empty store during offline startup.
      if (nextPacks.length === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        nextPacks = await listMissionPacks();
      }
      setPacks(nextPacks);
      if (!window.navigator.onLine && nextPacks.length > 0) {
        setSelectedPackId((current) => current ?? nextPacks[0].package_id);
      }
      setError(null);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Offline packs could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void reload();
    }, 0);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [reload]);

  const save = useCallback(async (input: MissionPackInput) => {
    setStatus("saving");
    try {
      const pack = await prepareMissionPack(input);
      await saveMissionPack(pack);
      setPacks((current) => [pack, ...current.filter((item) => item.region_id !== pack.region_id)]);
      setSelectedPackId(pack.package_id);
      setError(null);
      setStatus("ready");
      return pack;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Offline pack could not be saved.");
      setStatus("error");
      return null;
    }
  }, []);

  const importPack = useCallback(async (file: File) => {
    setStatus("saving");
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const pack = await importMissionPack(raw);
      setPacks((current) => [pack, ...current.filter((item) => item.region_id !== pack.region_id)]);
      setSelectedPackId(pack.package_id);
      setError(null);
      setStatus("ready");
      return pack;
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "The Mission Pack JSON could not be imported.");
      setStatus("error");
      return null;
    }
  }, []);

  const remove = useCallback(async (packageId: string) => {
    try {
      await deleteMissionPack(packageId);
      setPacks((current) => current.filter((pack) => pack.package_id !== packageId));
      setSelectedPackId((current) => current === packageId ? null : current);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Offline pack could not be deleted.");
      setStatus("error");
    }
  }, []);

  const select = useCallback((packageId: string | null) => {
    setSelectedPackId(packageId);
  }, []);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.package_id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  return {
    packs,
    selectedPack,
    selectedPackId,
    status,
    error,
    isOnline,
    reload,
    save,
    importPack,
    remove,
    select,
  };
}
