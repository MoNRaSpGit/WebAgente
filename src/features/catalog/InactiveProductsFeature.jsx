import { useMemo, useState } from 'react';
import {
  buildWebProductImageSrc,
  fetchWebAdminProductById,
  updateWebAdminProduct
} from '../../shared/api/productsApi.js';

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export function InactiveProductsFeature({
  token,
  loading,
  loadingMore,
  hasMore,
  error,
  items,
  total,
  onLoadMore
}) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [editingProductId, setEditingProductId] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    precio_venta: '',
    estado: 'inactivo',
    imagen_base64: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  async function openEditModal(product) {
    const productId = Number(product?.id || 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }

    setFormError('');
    setLoadingProduct(true);
    setEditingProductId(productId);
    setForm({
      nombre: String(product?.nombre || ''),
      precio_venta: String(Number(product?.precio_venta || 0).toFixed(2)),
      estado: String(product?.estado || 'inactivo').trim().toLowerCase() || 'inactivo',
      imagen_base64: ''
    });

    try {
      const fresh = await fetchWebAdminProductById(token, productId);
      if (fresh) {
        setForm({
          nombre: String(fresh?.nombre || ''),
          precio_venta: String(Number(fresh?.precio_venta || 0).toFixed(2)),
          estado: String(fresh?.estado || 'inactivo').trim().toLowerCase() || 'inactivo',
          imagen_base64: ''
        });
      }
    } catch (modalError) {
      if (Number(modalError?.status) !== 404) {
        setFormError(modalError.message || 'No se pudo cargar el producto');
      }
    } finally {
      setLoadingProduct(false);
    }
  }

  function closeEditModal(force = false) {
    if (saving && !force) {
      return;
    }
    setEditingProductId(null);
    setFormError('');
  }

  async function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await toDataUrl(file);
      setForm((current) => ({
        ...current,
        imagen_base64: dataUrl
      }));
      setFormError('');
    } catch (fileError) {
      setFormError(fileError.message || 'No se pudo cargar la imagen');
    }
  }

  async function handleSubmitEdit(event) {
    event.preventDefault();

    const parsedPrecio = Number(form.precio_venta);
    if (!form.nombre.trim()) {
      setFormError('Nombre requerido');
      return;
    }
    if (!Number.isFinite(parsedPrecio) || parsedPrecio <= 0) {
      setFormError('Precio valido requerido');
      return;
    }
    if (form.estado !== 'activo' && form.estado !== 'inactivo') {
      setFormError('Estado invalido');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await updateWebAdminProduct(token, editingProductId, {
        nombre: form.nombre.trim(),
        precio_venta: parsedPrecio,
        estado: form.estado,
        ...(form.imagen_base64 ? { imagen_base64: form.imagen_base64 } : {})
      });
      closeEditModal(true);
      await onLoadMore?.({ reset: true });
    } catch (saveError) {
      setFormError(saveError.message || 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inactive-shell">
      <div className="inactive-header">
        <h2>Actualizar</h2>
        <p>Productos no activos: {Number(total || safeItems.length)}</p>
      </div>

      {loading ? <p>Cargando productos no activos...</p> : null}
      {error ? <p className="home-error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <ul className="products-grid">
            {safeItems.map((product) => (
              <li key={product.id} className="product-card">
                <div className="product-card-image-wrap">
                  {product.has_local_image ? (
                    <img
                      className="product-card-image"
                      src={buildWebProductImageSrc(product.id)}
                      alt={product.nombre}
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-card-image product-card-image--placeholder">Sin imagen</div>
                  )}
                </div>
                <strong className="product-card-name">{product.nombre}</strong>
                <span className="product-card-price">${Number(product.precio_venta || 0).toFixed(2)}</span>
                <span className="inactive-tag">Estado: {String(product.estado || 'inactivo').trim().toLowerCase()}</span>
                <button
                  type="button"
                  className="product-card-edit"
                  onClick={() => openEditModal(product)}
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <div className="inactive-actions">
              <button type="button" onClick={() => onLoadMore?.()} disabled={loadingMore}>
                {loadingMore ? 'Cargando...' : 'Cargar mas'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {editingProductId ? (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Editar producto</h3>
            {loadingProduct ? <p>Cargando...</p> : null}
            <form onSubmit={handleSubmitEdit} className="modal-form">
              <label>
                Nombre
                <input
                  value={form.nombre}
                  onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                  disabled={saving || loadingProduct}
                />
              </label>
              <label>
                Precio
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.precio_venta}
                  onChange={(event) => setForm((current) => ({ ...current, precio_venta: event.target.value }))}
                  disabled={saving || loadingProduct}
                />
              </label>
              <label>
                Estado
                <select
                  value={form.estado}
                  onChange={(event) => setForm((current) => ({ ...current, estado: event.target.value }))}
                  disabled={saving || loadingProduct}
                >
                  <option value="inactivo">Inactivo</option>
                  <option value="activo">Activo</option>
                </select>
              </label>
              <label>
                Imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  disabled={saving || loadingProduct}
                />
              </label>
              {formError ? <p className="home-error">{formError}</p> : null}
              <div className="modal-actions">
                <button type="button" onClick={closeEditModal} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving || loadingProduct}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
