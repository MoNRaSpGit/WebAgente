import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchWebCategories,
  fetchWebProducts
} from '../../../shared/api/productsApi.js';
import { fetchMyWebOrders } from '../../../shared/api/webOrdersApi.js';
import { fetchMyWebProfile } from '../../../shared/api/webUsersApi.js';
import {
  CATEGORY_ALL,
  CATEGORY_OTHER,
  WEB_PRODUCTS_PAGE_LIMIT
} from '../home.constants.js';
import { normalizeSearchText } from '../home.utils.js';

export function useCatalogData({
  token,
  activeView,
  onBootstrapOrders,
  onBootstrapProfile
}) {
  const [products, setProducts] = useState([]);
  const [productsOffset, setProductsOffset] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(true);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [visibleProductsCount, setVisibleProductsCount] = useState(9);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL);
  const [lastFetchMs, setLastFetchMs] = useState(0);
  const [knownCategories, setKnownCategories] = useState([]);

  const loadMoreSentinelRef = useRef(null);
  const loadNextPageRef = useRef(null);
  const hasBootstrappedRef = useRef(false);
  const skipFirstCategoryReloadRef = useRef(true);
  const productCacheByCategoryRef = useRef(new Map());

  const normalizedSearch = useMemo(() => normalizeSearchText(searchTerm), [searchTerm]);
  const searchTokens = useMemo(
    () => normalizedSearch.split(' ').map((part) => part.trim()).filter(Boolean),
    [normalizedSearch]
  );
  const normalizedActiveCategory = useMemo(
    () => (activeCategory === CATEGORY_ALL || activeCategory === CATEGORY_OTHER
      ? ''
      : String(activeCategory || '').toLowerCase().replace(/\s+/g, ' ').trim()),
    [activeCategory]
  );
  const knownCategoriesNormalized = useMemo(
    () => new Set(
      knownCategories
        .map((item) => String(item || '').toLowerCase().replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ),
    [knownCategories]
  );

  const categories = useMemo(
    () => [CATEGORY_ALL, ...knownCategories, CATEGORY_OTHER],
    [knownCategories]
  );

  const filteredProducts = useMemo(() => {
    const activeCategoryNormalized = activeCategory === CATEGORY_ALL
      ? CATEGORY_ALL
      : String(activeCategory || '').toLowerCase().replace(/\s+/g, ' ').trim();

    const filtered = products.filter((item) => {
      const itemCategoryNormalized = String(item.categoria || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (activeCategoryNormalized === CATEGORY_OTHER) {
        const isOther = !itemCategoryNormalized || !knownCategoriesNormalized.has(itemCategoryNormalized);
        if (!isOther) {
          return false;
        }
      } else if (activeCategoryNormalized !== CATEGORY_ALL && itemCategoryNormalized !== activeCategoryNormalized) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const name = normalizeSearchText(item.nombre);
      const category = normalizeSearchText(item.categoria);
      const haystack = `${name} ${category}`.trim();
      return searchTokens.every((token) => haystack.includes(token));
    });

    return filtered.sort((a, b) => {
      const aHasImage = Boolean(a?.has_local_image);
      const bHasImage = Boolean(b?.has_local_image);
      if (aHasImage !== bHasImage) {
        return aHasImage ? -1 : 1;
      }
      return 0;
    });
  }, [activeCategory, knownCategoriesNormalized, normalizedSearch, products, searchTokens]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductsCount),
    [filteredProducts, visibleProductsCount]
  );

  const loadNextProductsPage = useCallback(async ({
    silent = false,
    offsetOverride = null,
    reset = false,
    categoryOverride = normalizedActiveCategory
  } = {}) => {
    if (!reset && (!productsHasMore || productsLoadingMore)) {
      return;
    }

    setProductsLoadingMore(true);
    const requestOffset = Number.isFinite(offsetOverride)
      ? Math.max(0, Math.floor(offsetOverride))
      : productsOffset;

    try {
      const startAt = performance.now();
      const result = await fetchWebProducts({
        limit: WEB_PRODUCTS_PAGE_LIMIT,
        offset: requestOffset,
        category: categoryOverride
      });
      setLastFetchMs(Math.round(performance.now() - startAt));

      let mergedItems = result.items;
      setProducts((current) => {
        if (reset || requestOffset === 0) {
          mergedItems = result.items;
          return result.items;
        }
        const nextItems = [...current, ...result.items];
        mergedItems = nextItems;
        return nextItems;
      });

      const nextOffset = requestOffset + result.items.length;
      const nextHasMore = Boolean(result.page?.has_more);
      const cacheKey = String(categoryOverride || '');
      productCacheByCategoryRef.current.set(cacheKey, {
        items: mergedItems,
        offset: nextOffset,
        hasMore: nextHasMore
      });

      setProductsOffset(nextOffset);
      setProductsHasMore(nextHasMore);
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      }
    } finally {
      setProductsLoadingMore(false);
    }
  }, [normalizedActiveCategory, productsHasMore, productsLoadingMore, productsOffset]);

  loadNextPageRef.current = loadNextProductsPage;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const productsResult = await fetchWebProducts({
          limit: WEB_PRODUCTS_PAGE_LIMIT,
          offset: 0,
          category: ''
        });

        if (!mounted) {
          return;
        }

        setProducts(productsResult.items);
        setProductsOffset(productsResult.items.length);
        setProductsHasMore(Boolean(productsResult.page?.has_more));
        productCacheByCategoryRef.current.set('', {
          items: productsResult.items,
          offset: productsResult.items.length,
          hasMore: Boolean(productsResult.page?.has_more)
        });
        setVisibleProductsCount(9);
        setError('');
        hasBootstrappedRef.current = true;
        setLoading(false);

        Promise.all([
          fetchWebCategories({ status: 'activo' }),
          fetchMyWebOrders(token, 20),
          fetchMyWebProfile(token)
        ])
          .then(([categoriesData, orders, profileData]) => {
            if (!mounted) {
              return;
            }
            setKnownCategories([...categoriesData].sort((a, b) => a.localeCompare(b)));
            onBootstrapOrders?.(orders);
            onBootstrapProfile?.(profileData);
          })
          .catch(() => {});
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError.message);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [onBootstrapOrders, onBootstrapProfile, token]);

  useEffect(() => {
    if (!hasBootstrappedRef.current || activeView !== 'catalog') {
      return;
    }

    if (skipFirstCategoryReloadRef.current) {
      skipFirstCategoryReloadRef.current = false;
      return;
    }

    let mounted = true;
    async function reloadProductsByCategory() {
      const cacheKey = String(normalizedActiveCategory || '');
      const cached = productCacheByCategoryRef.current.get(cacheKey);
      if (cached) {
        setError('');
        setLoading(false);
        setVisibleProductsCount(9);
        setProducts(cached.items);
        setProductsOffset(cached.offset);
        setProductsHasMore(Boolean(cached.hasMore));
        return;
      }

      setError('');
      setLoading(true);
      setVisibleProductsCount(9);
      setProducts([]);
      setProductsOffset(0);
      setProductsHasMore(true);

      try {
        const startAt = performance.now();
        const result = await fetchWebProducts({
          limit: WEB_PRODUCTS_PAGE_LIMIT,
          offset: 0,
          category: normalizedActiveCategory
        });
        setLastFetchMs(Math.round(performance.now() - startAt));
        if (!mounted) {
          return;
        }
        productCacheByCategoryRef.current.set(cacheKey, {
          items: result.items,
          offset: result.items.length,
          hasMore: Boolean(result.page?.has_more)
        });
        setProducts(result.items);
        setProductsOffset(result.items.length);
        setProductsHasMore(Boolean(result.page?.has_more));
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError.message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    reloadProductsByCategory();
    return () => {
      mounted = false;
    };
  }, [activeView, normalizedActiveCategory]);

  useEffect(() => {
    setVisibleProductsCount(9);
  }, [searchTerm, activeCategory]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(CATEGORY_ALL);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    if (activeView !== 'catalog' || !productsHasMore) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (loadNextPageRef.current) {
        loadNextPageRef.current({ silent: true });
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [activeView, productsHasMore, productsOffset]);

  useEffect(() => {
    if (!loadMoreSentinelRef.current || activeView !== 'catalog') {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting) {
        return;
      }

      setVisibleProductsCount((current) => Math.min(products.length, current + 9));
      if (visibleProductsCount + 9 >= filteredProducts.length && productsHasMore && loadNextPageRef.current) {
        loadNextPageRef.current({ silent: true });
      }
    }, { rootMargin: '300px' });

    observer.observe(loadMoreSentinelRef.current);
    return () => observer.disconnect();
  }, [activeView, filteredProducts.length, products.length, productsHasMore, visibleProductsCount]);

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
    productsLoadingMore,
    filteredProducts,
    visibleProducts,
    loadMoreSentinelRef
  };
}
