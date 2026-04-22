import {
  fetchWebCategories,
  fetchWebProductImagesBatch,
  fetchWebProducts
} from '../../shared/api/productsApi.js';

const PRELOAD_PRODUCTS_LIMIT = 500;
const PRELOAD_IMAGE_IDS_LIMIT = 12;
const PRELOAD_PUBLIC_TTL_MS = 90 * 1000;

let publicPreloadPromise = null;
let publicPreloadSnapshot = {
  categories: [],
  products: [],
  fetchedAt: 0
};

let imagePreloadPromise = null;
let imagePreloadSignature = '';
const imagePreloadMap = new Map();

function nowMs() {
  return Date.now();
}

function isSnapshotFresh(fetchedAt = 0) {
  return nowMs() - Number(fetchedAt || 0) <= PRELOAD_PUBLIC_TTL_MS;
}

function toImageDataUrl(item = {}) {
  const productId = Number(item?.product_id || 0);
  const mimeType = String(item?.mime_type || '').trim() || 'image/jpeg';
  const dataBase64 = String(item?.data_base64 || '').trim();
  if (!Number.isFinite(productId) || productId <= 0 || !dataBase64) {
    return null;
  }

  return {
    productId,
    dataUrl: `data:${mimeType};base64,${dataBase64}`
  };
}

function resolvePreloadImageIds(products = []) {
  return [...new Set(
    (Array.isArray(products) ? products : [])
      .filter((product) => Boolean(product?.has_local_image))
      .map((product) => Number(product?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0)
  )].slice(0, PRELOAD_IMAGE_IDS_LIMIT);
}

export function getPublicCatalogPreloadSnapshot() {
  return {
    categories: Array.isArray(publicPreloadSnapshot.categories) ? publicPreloadSnapshot.categories : [],
    products: Array.isArray(publicPreloadSnapshot.products) ? publicPreloadSnapshot.products : [],
    fetchedAt: Number(publicPreloadSnapshot.fetchedAt || 0)
  };
}

export function getImagePreloadMapForProducts(products = []) {
  const result = {};
  for (const productId of resolvePreloadImageIds(products)) {
    const dataUrl = imagePreloadMap.get(productId);
    if (dataUrl) {
      result[productId] = dataUrl;
    }
  }
  return result;
}

export function startPublicCatalogPreload() {
  if (isSnapshotFresh(publicPreloadSnapshot.fetchedAt) && publicPreloadSnapshot.products.length > 0) {
    return Promise.resolve(getPublicCatalogPreloadSnapshot());
  }

  if (publicPreloadPromise) {
    return publicPreloadPromise;
  }

  publicPreloadPromise = Promise.all([
    fetchWebCategories({ status: 'activo' }).catch(() => []),
    fetchWebProducts({ limit: PRELOAD_PRODUCTS_LIMIT, offset: 0, category: '' }).catch(() => ({ items: [] }))
  ])
    .then(([categories, productsResult]) => {
      const nextCategories = Array.isArray(categories) ? categories : [];
      const nextProducts = Array.isArray(productsResult?.items) ? productsResult.items : [];

      publicPreloadSnapshot = {
        categories: nextCategories,
        products: nextProducts,
        fetchedAt: nowMs()
      };

      return getPublicCatalogPreloadSnapshot();
    })
    .finally(() => {
      publicPreloadPromise = null;
    });

  return publicPreloadPromise;
}

export function startCatalogImagesPreloadFromProducts(products = []) {
  const imageIds = resolvePreloadImageIds(products);
  if (!imageIds.length) {
    return Promise.resolve({});
  }

  const signature = imageIds.join(',');
  const allCached = imageIds.every((id) => imagePreloadMap.has(id));
  if (allCached && imagePreloadSignature === signature) {
    return Promise.resolve(getImagePreloadMapForProducts(products));
  }

  if (imagePreloadPromise && imagePreloadSignature === signature) {
    return imagePreloadPromise;
  }

  imagePreloadSignature = signature;
  imagePreloadPromise = fetchWebProductImagesBatch(imageIds)
    .then((items) => {
      for (const item of items) {
        const parsed = toImageDataUrl(item);
        if (!parsed) {
          continue;
        }
        imagePreloadMap.set(parsed.productId, parsed.dataUrl);
      }
      return getImagePreloadMapForProducts(products);
    })
    .catch(() => getImagePreloadMapForProducts(products))
    .finally(() => {
      imagePreloadPromise = null;
    });

  return imagePreloadPromise;
}

