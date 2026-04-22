import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWebProductImageSrc } from '../../../shared/api/productsApi.js';

const MAX_CONCURRENT_FALLBACK_FETCHES = 3;
let activeFallbackFetches = 0;
const fallbackQueue = [];

function acquireFallbackSlot() {
  return new Promise((resolve) => {
    if (activeFallbackFetches < MAX_CONCURRENT_FALLBACK_FETCHES) {
      activeFallbackFetches += 1;
      resolve();
      return;
    }
    fallbackQueue.push(resolve);
  });
}

function releaseFallbackSlot() {
  const next = fallbackQueue.shift();
  if (next) {
    next();
    return;
  }
  activeFallbackFetches = Math.max(0, activeFallbackFetches - 1);
}

export function ProductImage({
  product,
  priority,
  prefetchedImageSrc,
  onImageLoadError,
  onImageLoaded,
  disableNetworkFetch = false
}) {
  const hasImage = Boolean(product?.has_local_image);
  const imageUrl = hasImage ? buildWebProductImageSrc(product?.id) : '';
  const [attempt, setAttempt] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [usingPrefetched, setUsingPrefetched] = useState(Boolean(prefetchedImageSrc));
  const [fallbackSlotReady, setFallbackSlotReady] = useState(false);
  const slotHeldRef = useRef(false);
  const slotTicketRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  const imageSrc = useMemo(() => {
    if (usingPrefetched && prefetchedImageSrc) {
      return prefetchedImageSrc;
    }
    if (disableNetworkFetch) {
      return '';
    }
    if (!fallbackSlotReady) {
      return '';
    }
    if (!imageUrl) {
      return '';
    }
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}r=${attempt}`;
  }, [attempt, disableNetworkFetch, fallbackSlotReady, imageUrl, prefetchedImageSrc, usingPrefetched]);

  useEffect(() => {
    setAttempt(0);
    setHasError(false);
    setUsingPrefetched(Boolean(prefetchedImageSrc));
    setFallbackSlotReady(false);
  }, [imageUrl, product?.id]);

  useEffect(() => () => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    if (slotHeldRef.current) {
      slotHeldRef.current = false;
      releaseFallbackSlot();
    }
  }, []);

  useEffect(() => {
    if (hasError) {
      onImageLoadError?.(Number(product?.id || 0));
    }
  }, [hasError, onImageLoadError, product?.id]);

  useEffect(() => {
    if (usingPrefetched || disableNetworkFetch || !hasImage || hasError || fallbackSlotReady) {
      return;
    }

    let cancelled = false;
    const ticket = slotTicketRef.current + 1;
    slotTicketRef.current = ticket;

    acquireFallbackSlot().then(() => {
      if (cancelled || ticket !== slotTicketRef.current) {
        releaseFallbackSlot();
        return;
      }
      slotHeldRef.current = true;
      setFallbackSlotReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [disableNetworkFetch, fallbackSlotReady, hasError, hasImage, usingPrefetched]);

  return (
    <div className="product-card-image-wrap">
      {hasImage && !hasError && imageSrc ? (
        <img
          className="product-card-image"
          src={imageSrc}
          alt={product.nombre}
          loading={priority ? 'eager' : 'lazy'}
          fetchpriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => {
            setHasError(false);
            if (slotHeldRef.current) {
              slotHeldRef.current = false;
              releaseFallbackSlot();
            }
            onImageLoaded?.(Number(product?.id || 0));
          }}
          onError={() => {
            if (usingPrefetched) {
              setUsingPrefetched(false);
              setAttempt(0);
              return;
            }
            if (attempt < 2) {
              const nextAttempt = attempt + 1;
              retryTimeoutRef.current = window.setTimeout(() => {
                setAttempt(nextAttempt);
              }, 120 * nextAttempt);
              return;
            }
            setHasError(true);
            if (slotHeldRef.current) {
              slotHeldRef.current = false;
              releaseFallbackSlot();
            }
          }}
        />
      ) : (
        <div className="product-card-image product-card-image--placeholder">
          {hasImage ? 'Cargando imagen...' : 'Sin imagen'}
        </div>
      )}
    </div>
  );
}
