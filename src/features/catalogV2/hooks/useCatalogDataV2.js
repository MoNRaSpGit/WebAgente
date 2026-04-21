import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWebCategories, fetchWebProducts } from '../../../shared/api/productsApi.js';
import { fetchMyWebOrders } from '../../../shared/api/webOrdersApi.js';
import { fetchMyWebProfile } from '../../../shared/api/webUsersApi.js';
import {
  CATEGORY_ALL,
  CATEGORY_OTHER,
  WEB_PRODUCTS_FIRST_VISIBLE_COUNT,
  WEB_PRODUCTS_LOAD_MORE_STEP,
  WEB_PRODUCTS_MAX_PAGES,
  WEB_PRODUCTS_PAGE_LIMIT
} from '../../home/home.constants.js';
import { normalizeSearchText } from '../../home/home.utils.js';

const PRODUCT_NAME_COLLATOR = new Intl.Collator('es', {
  sensitivity: 'base',
  numeric: true
});

function compactCategory(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function uniqueByProductId(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const id = Number(item?.id || 0);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(item);
  }
  return result;
}

function mergeUniqueProducts(currentItems = [], nextItems = []) {
  return uniqueByProductId([...currentItems, ...nextItems]);
}

export function useCatalogDataV2({
  token,
  activeView,
  onBootstrapOrders,
  onBootstrapProfile
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL);
  const [lastFetchMs, setLastFetchMs] = useState(0);
  const [knownCategories, setKnownCategories] = useState([]);
  const [visibleProductsCount, setVisibleProductsCount] = useState(WEB_PRODUCTS_FIRST_VISIBLE_COUNT);

  const loadMoreSentinelRef = useRef(null);

  const normalizedSearch = useMemo(() => normalizeSearchText(searchTerm), [searchTerm]);
  const searchTokens = useMemo(
    () => normalizedSearch.split(' ').map((part) => part.trim()).filter(Boolean),
    [normalizedSearch]
  );

  const knownCategoriesNormalized = useMemo(
    () => new Set(
      knownCategories
        .map((item) => compactCategory(item))
        .filter(Boolean)
    ),
    [knownCategories]
  );

  const categories = useMemo(() => {
    const hasExplicitOthers = knownCategories.some((category) => compactCategory(category) === 'otros');
    return hasExplicitOthers
      ? [CATEGORY_ALL, ...knownCategories]
      : [CATEGORY_ALL, ...knownCategories, CATEGORY_OTHER];
  }, [knownCategories]);

  const filteredProducts = useMemo(() => {
    const activeCategoryCompact = activeCategory === CATEGORY_ALL ? CATEGORY_ALL : compactCategory(activeCategory);

    const filtered = products.filter((item) => {
      const categoryCompact = compactCategory(item?.categoria);

      if (activeCategoryCompact === CATEGORY_OTHER) {
        if (categoryCompact && knownCategoriesNormalized.has(categoryCompact)) {
          return false;
        }
      } else if (activeCategoryCompact !== CATEGORY_ALL && categoryCompact !== activeCategoryCompact) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const name = normalizeSearchText(item?.nombre);
      const category = normalizeSearchText(item?.categoria);
      const haystack = `${name} ${category}`.trim();
      return searchTokens.every((token) => haystack.includes(token));
    });

    return filtered.sort((a, b) => {
      const nameA = String(a?.nombre || '').trim();
      const nameB = String(b?.nombre || '').trim();
      const byName = PRODUCT_NAME_COLLATOR.compare(nameA, nameB);
      if (byName !== 0) {
        return byName;
      }

      return Number(a?.id || 0) - Number(b?.id || 0);
    });
  }, [activeCategory, knownCategoriesNormalized, normalizedSearch, products, searchTokens]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductsCount),
    [filteredProducts, visibleProductsCount]
  );

  useEffect(() => {
    let mounted = true;

    async function hydrateRemainingProducts({ offset, startedAt }) {
      let nextOffset = Number(offset || 0);

      for (let page = 1; page < WEB_PRODUCTS_MAX_PAGES; page += 1) {
        if (!mounted) {
          return;
        }

        try {
          const result = await fetchWebProducts({
            limit: WEB_PRODUCTS_PAGE_LIMIT,
            offset: nextOffset,
            category: ''
          });

          const pageItems = Array.isArray(result.items) ? result.items : [];
          if (!mounted || pageItems.length === 0) {
            return;
          }

          setProducts((current) => mergeUniqueProducts(current, pageItems));
          nextOffset += pageItems.length;

          if (!result?.page?.has_more) {
            break;
          }
        } catch {
          // No cortamos la UX por fallos de hidratar paginas adicionales.
          break;
        }
      }

      if (mounted) {
        setLastFetchMs(Math.round(performance.now() - startedAt));
      }
    }

    async function loadInitialData() {
      try {
        setLoading(true);
        setError('');
        const startAt = performance.now();

        const bootstrapPromise = Promise.all([
          fetchWebCategories({ status: 'activo' }).catch(() => []),
          fetchMyWebOrders(token, 20).catch(() => []),
          fetchMyWebProfile(token).catch(() => null)
        ]);
        const firstPageResult = await fetchWebProducts({
          limit: WEB_PRODUCTS_PAGE_LIMIT,
          offset: 0,
          category: ''
        });
        const firstPageItems = Array.isArray(firstPageResult?.items) ? firstPageResult.items : [];
        const [categoryList, orders, profileData] = await bootstrapPromise;

        if (!mounted) {
          return;
        }

        const uniqueProducts = uniqueByProductId(firstPageItems);
        setProducts(uniqueProducts);
        setVisibleProductsCount(WEB_PRODUCTS_FIRST_VISIBLE_COUNT);

        const uniqueCategories = [];
        const seenCategories = new Set();
        for (const category of categoryList) {
          const name = String(category || '').trim();
          const key = compactCategory(name);
          if (!name || !key || seenCategories.has(key)) {
            continue;
          }
          seenCategories.add(key);
          uniqueCategories.push(name);
        }
        setKnownCategories(uniqueCategories);

        onBootstrapOrders?.(Array.isArray(orders) ? orders : []);
        onBootstrapProfile?.(profileData);
        setLastFetchMs(Math.round(performance.now() - startAt));
        setLoading(false);

        const canHydrateMore = Boolean(firstPageResult?.page?.has_more) && firstPageItems.length > 0;
        if (canHydrateMore) {
          hydrateRemainingProducts({
            offset: firstPageItems.length,
            startedAt: startAt
          });
        }
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError.message || 'No se pudieron cargar los productos');
        setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [onBootstrapOrders, onBootstrapProfile, token]);

  useEffect(() => {
    setVisibleProductsCount(WEB_PRODUCTS_FIRST_VISIBLE_COUNT);
  }, [searchTerm, activeCategory]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(CATEGORY_ALL);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    if (!loadMoreSentinelRef.current || activeView !== 'catalog') {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting || loading) {
        return;
      }

      setVisibleProductsCount((current) => {
        if (current >= filteredProducts.length) {
          return current;
        }
        return Math.min(filteredProducts.length, current + WEB_PRODUCTS_LOAD_MORE_STEP);
      });
    }, { rootMargin: '260px' });

    observer.observe(loadMoreSentinelRef.current);
    return () => observer.disconnect();
  }, [activeView, filteredProducts.length, loading]);

  function applyLocalProductPatch(productId, patch = {}) {
    const parsedId = Number(productId || 0);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      return;
    }

    setProducts((current) => current.map((item) => (
      Number(item?.id) === parsedId
        ? { ...item, ...patch }
        : item
    )));

    const nextCategory = String(patch?.categoria || '').trim();
    if (nextCategory) {
      setKnownCategories((current) => {
        const exists = current.some((category) => compactCategory(category) === compactCategory(nextCategory));
        return exists ? current : [...current, nextCategory];
      });
    }
  }

  return {
    loading,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    categories,
    lastFetchMs,
    productsLoadingMore: visibleProductsCount < filteredProducts.length,
    filteredProducts,
    visibleProducts,
    loadMoreSentinelRef,
    applyLocalProductPatch
  };
}
