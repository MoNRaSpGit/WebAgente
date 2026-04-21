import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWebInactiveProducts } from '../../../shared/api/productsApi.js';
import { WEB_INACTIVE_PRODUCTS_PAGE_LIMIT } from '../home.constants.js';

export function useInactiveProducts(activeView, enabled = false) {
  const [inactiveProducts, setInactiveProducts] = useState([]);
  const [inactiveTotal, setInactiveTotal] = useState(0);
  const [inactiveOffset, setInactiveOffset] = useState(0);
  const [inactiveHasMore, setInactiveHasMore] = useState(true);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveLoadingMore, setInactiveLoadingMore] = useState(false);
  const [inactiveError, setInactiveError] = useState('');
  const inactiveOffsetRef = useRef(0);
  const inactiveHasMoreRef = useRef(true);
  const inactiveLoadingMoreRef = useRef(false);

  const loadInactiveProductsPage = useCallback(async ({ reset = false, silent = false } = {}) => {
    if (!enabled) {
      return;
    }

    if (!reset && (!inactiveHasMoreRef.current || inactiveLoadingMoreRef.current)) {
      return;
    }

    if (reset) {
      setInactiveLoading(true);
      setInactiveError('');
      setInactiveProducts([]);
      setInactiveTotal(0);
      setInactiveOffset(0);
      setInactiveHasMore(true);
      inactiveOffsetRef.current = 0;
      inactiveHasMoreRef.current = true;
    } else {
      setInactiveLoadingMore(true);
      inactiveLoadingMoreRef.current = true;
      if (!silent) {
        setInactiveError('');
      }
    }

    const requestOffset = reset ? 0 : inactiveOffsetRef.current;

    try {
      const result = await fetchWebInactiveProducts({
        limit: WEB_INACTIVE_PRODUCTS_PAGE_LIMIT,
        offset: requestOffset
      });

      const nextItems = Array.isArray(result.items) ? result.items : [];
      const nextOffset = requestOffset + nextItems.length;
      const nextHasMore = Boolean(result.page?.has_more);
      const nextTotal = Number(result.page?.total || 0);

      setInactiveProducts((current) => (reset ? nextItems : [...current, ...nextItems]));
      setInactiveTotal(nextTotal);
      setInactiveOffset(nextOffset);
      setInactiveHasMore(nextHasMore);
      inactiveOffsetRef.current = nextOffset;
      inactiveHasMoreRef.current = nextHasMore;
    } catch (loadError) {
      if (!silent) {
        setInactiveError(loadError.message);
      }
    } finally {
      setInactiveLoading(false);
      setInactiveLoadingMore(false);
      inactiveLoadingMoreRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    async function loadInactive() {
      if (!enabled) {
        setInactiveProducts([]);
        setInactiveTotal(0);
        setInactiveOffset(0);
        setInactiveHasMore(true);
        setInactiveError('');
        inactiveOffsetRef.current = 0;
        inactiveHasMoreRef.current = true;
        inactiveLoadingMoreRef.current = false;
        return;
      }

      if (activeView !== 'update') {
        return;
      }

      await loadInactiveProductsPage({ reset: true });
    }

    loadInactive();
  }, [activeView, enabled, loadInactiveProductsPage]);

  return {
    inactiveProducts,
    inactiveTotal,
    inactiveHasMore,
    inactiveLoading,
    inactiveLoadingMore,
    inactiveError,
    loadInactiveProductsPage
  };
}
