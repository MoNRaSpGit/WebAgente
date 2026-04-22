import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWebProductImageSrc } from '../../../shared/api/productsApi.js';

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
  const retryTimeoutRef = useRef(null);

  const imageSrc = useMemo(() => {
    if (usingPrefetched && prefetchedImageSrc) {
      return prefetchedImageSrc;
    }
    if (disableNetworkFetch) {
      return '';
    }
    if (!imageUrl) {
      return '';
    }
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}r=${attempt}`;
  }, [attempt, disableNetworkFetch, imageUrl, prefetchedImageSrc, usingPrefetched]);

  useEffect(() => {
    setAttempt(0);
    setHasError(false);
    setUsingPrefetched(Boolean(prefetchedImageSrc));
  }, [imageUrl, product?.id]);

  useEffect(() => () => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (hasError) {
      onImageLoadError?.(Number(product?.id || 0));
    }
  }, [hasError, onImageLoadError, product?.id]);

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
