import { useCallback, useEffect, useState } from 'react';
import { fetchWebInactiveProducts } from '../../../shared/api/productsApi.js';
import { WEB_INACTIVE_PRODUCTS_PAGE_LIMIT } from '../home.constants.js';

export function useInactiveProducts(activeView) {
  const [inactiveProducts, setInactiveProducts] = useState([]);
  const [inactiveOffset, setInactiveOffset] = useState(0);
  const [inactiveHasMore, setInactiveHasMore] = useState(true);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveLoadingMore, setInactiveLoadingMore] = useState(false);
  const [inactiveError, setInactiveError] = useState('');

  const loadInactiveProductsPage = useCallback(async ({ reset = false, silent = false } = {}) => {
    if (!reset && (!inactiveHasMore || inactiveLoadingMore)) {
      return;
    }

    if (reset) {
      setInactiveLoading(true);
      setInactiveError('');
      setInactiveProducts([]);
      setInactiveOffset(0);
      setInactiveHasMore(true);
    } else {
      setInactiveLoadingMore(true);
      if (!silent) {
        setInactiveError('');
      }
    }

    const requestOffset = reset ? 0 : inactiveOffset;

    try {
      const result = await fetchWebInactiveProducts({
        limit: WEB_INACTIVE_PRODUCTS_PAGE_LIMIT,
        offset: requestOffset
      });

      setInactiveProducts((current) => (reset ? result.items : [...current, ...result.items]));
      setInactiveOffset(requestOffset + result.items.length);
      setInactiveHasMore(Boolean(result.page?.has_more));
    } catch (loadError) {
      if (!silent) {
        setInactiveError(loadError.message);
      }
    } finally {
      setInactiveLoading(false);
      setInactiveLoadingMore(false);
    }
  }, [inactiveHasMore, inactiveLoadingMore, inactiveOffset]);

  useEffect(() => {
    async function loadInactive() {
      if (activeView !== 'update') {
        return;
      }
      await loadInactiveProductsPage({ reset: true });
    }

    loadInactive();
  }, [activeView, loadInactiveProductsPage]);

  return {
    inactiveProducts,
    inactiveHasMore,
    inactiveLoading,
    inactiveLoadingMore,
    inactiveError,
    loadInactiveProductsPage
  };
}
