import { useMemo } from 'react';
import { useProviderStore } from '../store/slices/providerSlice';

/**
 * Hook to get the active model for the current provider
 *
 * This is the single source of truth for getting the current model
 * in the application. It reads from the provider configuration, not
 * from a global model setting.
 *
 * @returns The active model for the current provider, or undefined if not set
 *
 * @example
 * ```ts
 * const activeModel = useActiveModel();
 *
 * // Use in API calls
 * await client.chat.completions.create({
 *   model: activeModel || 'default',
 *   ...
 * });
 * ```
 */
export function useActiveModel(): string | undefined {
  const currentProvider = useProviderStore((state) => state.currentProvider);
  const providerConfig = useProviderStore((state) => state.providerConfig);

  const activeModel = useMemo(() => {
    const config = providerConfig.providers[currentProvider];

    if (!config) {
      return undefined;
    }

    // Return the model if it exists
    if ('model' in config && config.model) {
      return config.model;
    }

    return undefined;
  }, [currentProvider, providerConfig]);

  return activeModel;
}

/**
 * Hook to get both the active model and provider info
 *
 * @returns Object containing activeModel, currentProvider, and providerConfig
 */
export function useActiveModelInfo() {
  const activeModel = useActiveModel();
  const currentProvider = useProviderStore((state) => state.currentProvider);
  const providerConfig = useProviderStore((state) => state.providerConfig);

  return useMemo(() => ({
    activeModel,
    currentProvider,
    providerConfig,
  }), [activeModel, currentProvider, providerConfig]);
}
