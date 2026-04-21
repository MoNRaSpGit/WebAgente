import { useMemo, useRef, useState } from 'react';
import { fetchWebAdminProductById, updateWebAdminProduct } from '../../../shared/api/productsApi.js';

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function buildInitialForm() {
  return {
    nombre: '',
    precio_venta: '',
    categoria: '',
    imagen_base64: ''
  };
}

function buildInitialOriginal() {
  return {
    nombre: '',
    precio_venta: '',
    categoria: ''
  };
}

export function useAdminProductEditor({
  token,
  categories,
  applyLocalProductPatch,
  setError
}) {
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingForm, setEditingForm] = useState(buildInitialForm());
  const [editingOriginal, setEditingOriginal] = useState(buildInitialOriginal());
  const [loadingEditProduct, setLoadingEditProduct] = useState(false);
  const [savingEditProduct, setSavingEditProduct] = useState(false);
  const requestSeqRef = useRef(0);

  const editableCategories = useMemo(
    () => categories.filter((category) => category !== 'all' && category !== '__other__'),
    [categories]
  );

  const editableCategoriesWithCurrent = useMemo(() => {
    const next = new Set(editableCategories);
    const currentValue = String(editingOriginal?.categoria || '').trim();
    if (currentValue) {
      next.add(currentValue);
    }
    return Array.from(next);
  }, [editableCategories, editingOriginal?.categoria]);

  function closeEditor(force = false) {
    if (savingEditProduct && !force) {
      return;
    }
    requestSeqRef.current += 1;
    setEditingProductId(null);
    setEditingForm(buildInitialForm());
    setEditingOriginal(buildInitialOriginal());
    setLoadingEditProduct(false);
  }

  function openEditor(product) {
    const productId = Number(product?.id || 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }

    const currentCategory = String(product?.categoria || '').trim();
    const currentName = String(product?.nombre || '').trim();
    const currentPrice = Number(product?.precio_venta || 0);
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    setEditingProductId(productId);
    setEditingForm({
      nombre: currentName,
      precio_venta: String(Number(currentPrice).toFixed(2)),
      categoria: currentCategory,
      imagen_base64: ''
    });
    setEditingOriginal({
      nombre: currentName,
      precio_venta: Number(currentPrice).toFixed(2),
      categoria: currentCategory
    });
    setLoadingEditProduct(true);

    fetchWebAdminProductById(token, productId)
      .then((fresh) => {
        if (!fresh || requestSeqRef.current !== seq) {
          return;
        }
        const freshName = String(fresh?.nombre || '').trim();
        const freshPrice = Number(fresh?.precio_venta || 0);
        const freshCategory = String(fresh?.categoria || currentCategory).trim();
        setEditingForm((current) => ({
          ...current,
          nombre: freshName,
          precio_venta: String(Number(freshPrice).toFixed(2)),
          categoria: freshCategory
        }));
        setEditingOriginal({
          nombre: freshName,
          precio_venta: Number(freshPrice).toFixed(2),
          categoria: freshCategory
        });
      })
      .catch(() => {
        // Si no se puede refrescar el producto, seguimos con datos del catalogo.
      })
      .finally(() => {
        if (requestSeqRef.current === seq) {
          setLoadingEditProduct(false);
        }
      });
  }

  async function onImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const imageData = await toDataUrl(file);
      setEditingForm((current) => ({
        ...current,
        imagen_base64: imageData
      }));
    } catch (imageError) {
      setError(imageError.message || 'No se pudo leer la imagen');
    }
  }

  async function submitEditor() {
    const productId = Number(editingProductId || 0);
    const nextName = String(editingForm?.nombre || '').trim();
    const nextPriceText = String(editingForm?.precio_venta || '').trim();
    const nextCategory = String(editingForm?.categoria || '').trim();
    const nextImageBase64 = String(editingForm?.imagen_base64 || '').trim();
    const originalName = String(editingOriginal?.nombre || '').trim();
    const originalPrice = String(editingOriginal?.precio_venta || '').trim();
    const originalCategory = String(editingOriginal?.categoria || '').trim();
    const parsedPrice = Number(nextPriceText);

    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    if (!nextName) {
      setError('Nombre requerido');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Precio valido requerido');
      return;
    }
    if (!nextCategory) {
      setError('Categoria requerida');
      return;
    }

    const patch = {};
    if (nextName.toLowerCase() !== originalName.toLowerCase()) {
      patch.nombre = nextName;
    }
    if (Number(parsedPrice).toFixed(2) !== Number(originalPrice || 0).toFixed(2)) {
      patch.precio_venta = parsedPrice;
    }
    if (nextCategory.toLowerCase() !== originalCategory.toLowerCase()) {
      patch.categoria = nextCategory;
    }
    if (nextImageBase64) {
      patch.imagen_base64 = nextImageBase64;
    }

    if (Object.keys(patch).length === 0) {
      closeEditor();
      return;
    }

    try {
      setSavingEditProduct(true);
      await updateWebAdminProduct(token, productId, patch);
      applyLocalProductPatch(productId, {
        ...(patch.nombre ? { nombre: patch.nombre } : {}),
        ...(typeof patch.precio_venta === 'number' ? { precio_venta: patch.precio_venta } : {}),
        ...(patch.categoria ? { categoria: patch.categoria } : {}),
        ...(patch.imagen_base64 ? { has_local_image: true } : {})
      });
      closeEditor(true);
    } catch (updateError) {
      setError(updateError.message || 'No se pudo actualizar el producto');
    } finally {
      setSavingEditProduct(false);
    }
  }

  return {
    editingProductId,
    editingForm,
    setEditingForm,
    loadingEditProduct,
    savingEditProduct,
    editableCategoriesWithCurrent,
    openEditor,
    closeEditor,
    onImageChange,
    submitEditor
  };
}
