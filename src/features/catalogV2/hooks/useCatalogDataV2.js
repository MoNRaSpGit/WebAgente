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

    return products.filter((item) => {
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
  }, [activeCategory, knownCategoriesNormalized, normalizedSearch, products, searchTokens]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductsCount),
    [filteredProducts, visibleProductsCount]
  );

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError('');
        const startAt = performance.now();

        let offset = 0;
        const allProducts = [];

        for (let page = 0; page < WEB_PRODUCTS_MAX_PAGES; page += 1) {
          const result = await fetchWebProducts({
            limit: WEB_PRODUCTS_PAGE_LIMIT,
            offset,
            category: ''
          });

          const pageItems = Array.isArray(result.items) ? result.items : [];
          allProducts.push(...pageItems);

          offset += pageItems.length;
          if (!result?.page?.has_more || pageItems.length === 0) {
            break;
          }
        }

        const [categoryList, orders, profileData] = await Promise.all([
          fetchWebCategories({ status: 'activo' }).catch(() => []),
          fetchMyWebOrders(token, 20).catch(() => []),
          fetchMyWebProfile(token).catch(() => null)
        ]);

        if (!mounted) {
          return;
        }

        const uniqueProducts = uniqueByProductId(allProducts);
        setProducts(uniqueProducts);
        setLastFetchMs(Math.round(performance.now() - startAt));
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
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError.message || 'No se pudieron cargar los productos');
      } finally {
        if (mounted) {
          setLoading(false);
        }
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
    loadMoreSentinelRef
  };
}
