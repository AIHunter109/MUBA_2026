import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { apiGet, apiPost } from '@/lib/sui/api';

export type Recipient = { id: string; name: string; address: string; createdAt: string };

type State = {
  recipients: Recipient[];
  isLoading: boolean;
  error: string | null;
};

export function useRecipients() {
  const { session } = useAuth();
  const owner = session?.walletAddress;
  const [state, setState] = useState<State>({ recipients: [], isLoading: true, error: null });

  const refresh = useCallback(async () => {
    if (!owner) {
      setState({ recipients: [], isLoading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const { recipients } = await apiGet<{ recipients: Recipient[] }>(
        `/v1/recipients?owner=${encodeURIComponent(owner)}`,
      );
      setState({ recipients, isLoading: false, error: null });
    } catch (error) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Could not load recipients.',
      }));
    }
  }, [owner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string, address: string) => {
      if (!owner) {
        throw new Error('Not signed in');
      }
      await apiPost('/v1/recipients', { owner, name, address });
      await refresh();
    },
    [owner, refresh],
  );

  const update = useCallback(
    async (id: string, name: string, address: string) => {
      if (!owner) {
        throw new Error('Not signed in');
      }
      await apiPost('/v1/recipients/update', { owner, id, name, address });
      await refresh();
    },
    [owner, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!owner) {
        throw new Error('Not signed in');
      }
      await apiPost('/v1/recipients/delete', { owner, id });
      await refresh();
    },
    [owner, refresh],
  );

  return { ...state, refresh, add, update, remove };
}
