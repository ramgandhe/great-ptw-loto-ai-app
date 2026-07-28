import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getOfflineDatabaseStatus,
  getPendingSyncCount,
  initOfflineDatabase,
  processSyncQueue,
  subscribeToNetworkStatus,
  type SyncResult,
} from "@/lib/offline";

type OfflineContextValue = {
  isReady: boolean;
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  syncNow: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

async function refreshPendingCount(): Promise<number> {
  return getPendingSyncCount();
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const syncNow = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      setLastSyncResult(result);
      setPendingCount(await refreshPendingCount());
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    let active = true;

    initOfflineDatabase()
      .then(async () => {
        if (!active) {
          return;
        }
        const status = await getOfflineDatabaseStatus();
        setIsReady(status.ready);
        setPendingCount(await refreshPendingCount());
      })
      .catch(() => {
        if (active) {
          setIsReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((online) => {
      setIsOnline(online);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isReady || !isOnline || pendingCount === 0 || isSyncing) {
      return;
    }

    void syncNow();
  }, [isReady, isOnline, pendingCount, isSyncing, syncNow]);

  const value = useMemo(
    () => ({
      isReady,
      isOnline,
      pendingCount,
      isSyncing,
      lastSyncResult,
      syncNow,
    }),
    [isReady, isOnline, pendingCount, isSyncing, lastSyncResult, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return context;
}
