import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWebProductImageSrc } from '../../../shared/api/productsApi.js';

export function ProductImage({ product, priority, onImageLoadError, onImageLoaded }) {
  const hasImage = Boolean(product?.has_local_image);
  const imageUrl = hasImage ? buildWebProductImageSrc(product?.id) : '';
  const [attempt, setAttempt] = useState(0);
  const [hasError, setHasError] = useState(false);
  const retryTimeoutRef = useRef(null);

  const imageSrc = useMemo(() => {
    if (!imageUrl) {
      return '';
    }
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}r=${attempt}`;
  }, [attempt, imageUrl]);

  useEffect(() => {
    setAttempt(0);
    setHasError(false);
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
          Sin imagen
        </div>
      )}
    </div>
  );
}
