import useSWR, { mutate as globalMutate } from 'swr';
import { rpcCall } from '@/lib/rpc';
import { auth } from '@/lib/firebase';
import { getAppState, setAppState } from '@/lib/appStateStore';

const fetcher = async ([action, currentUid, pgId]: any[]) => {
  const result = await rpcCall(action, currentUid, pgId);
  if (result?.success && result?.data && pgId) {
    setAppState(`hostelData_${pgId}`, result);
  }
  return result;
};

export function notifyHostelDataChanged(pgId?: string | null) {
  if (typeof window !== 'undefined') {
    const uid = localStorage.getItem('userUid') || auth.currentUser?.uid;
    const activePg = pgId || localStorage.getItem('activePgId');
    if (uid && activePg) {
      globalMutate(['getInitialAppData', uid, activePg]);
    }
  }
}

export function useHostelData(pgId?: string | null) {
  const uid = typeof window !== 'undefined' ? localStorage.getItem('userUid') : null;
  const currentUid = auth.currentUser?.uid || uid;
  const activePgId = pgId || (typeof window !== 'undefined' ? localStorage.getItem('activePgId') : null);

  const cachedResult = typeof window !== 'undefined' && activePgId ? getAppState(`hostelData_${activePgId}`) : null;

  const { data, error, isLoading, mutate } = useSWR(
    currentUid && activePgId ? ['getInitialAppData', currentUid, activePgId] : null,
    fetcher,
    {
      fallbackData: cachedResult || undefined,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      keepPreviousData: true
    }
  );

  const effectiveData = data?.data || cachedResult?.data || null;

  return {
    data: effectiveData,
    error,
    isLoading: isLoading && !effectiveData,
    isValidating: !data && isLoading,
    mutate
  };
}
