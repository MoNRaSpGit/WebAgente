# WebAgente

Frontend web publico separado de `FrontAgente`.

## Documentacion relacionada

- Web (este archivo): [WebAgente/README.md](C:\Users\ju4nr\OneDrive\Desktop\PilotoAgente\WebAgente\README.md)
- Backend de la parte web: [BackAgente/README.md](C:\Users\ju4nr\OneDrive\Desktop\PilotoAgente\BackAgente\README.md)

## Inicio rapido

```bash
npm install
npm run dev
```

### Entornos (local vs produccion)

- `/.env` (local):
```bash
VITE_API_URL=http://localhost:3000
VITE_GH_PAGES_BASE=/WebAgente/
```

- `/.env.production` (GitHub Pages / produccion):
```bash
VITE_API_URL=https://pilotoagente.onrender.com
VITE_GH_PAGES_BASE=/WebAgente/
```

## Deploy en GitHub Pages

1. Verificar `/.env.production`.
2. Publicar:
```bash
npm run deploy
```

URL esperada:

`https://monraspgit.github.io/WebAgente/`

## Metodo para aumentar la velocidad de productos

Objetivo: render rapido, payload liviano e imagenes bajo demanda.

1. Listado sin blob de imagen:
- En `/api/web/products` se devuelven metadatos livianos y `has_local_image`.
- No se incluye la imagen pesada dentro del JSON del listado.

2. Endpoint separado de imagen:
- `GET /api/web/products/:productId/image`
- La imagen se pide solo cuando el producto la necesita.

3. Lazy load por viewport:
- El frontend renderiza primero nombre/precio.
- La imagen se carga al entrar en viewport (`IntersectionObserver`).

4. Cache de imagen:
- Cache HTTP en backend con `Cache-Control`.
- Cache en frontend para no pedir la misma imagen repetidamente.

5. Categorias separadas:
- `GET /api/web/categories` para cargar filtros rapido, sin depender del listado.

6. Carga paralela inicial:
- `Promise.all` para productos + categorias + perfil + pedidos.

7. Paginacion grande para menos tandas:
- Front usa `limit` alto (actualmente 500).
- Backend permite hasta 500 por request.

8. SQL optimizado:
- Filtros index-friendly (`p.estado = ?`).
- Indices clave en `ops_producto`:
  - `idx_producto_estado (estado)`
  - `idx_producto_estado_categoria_id (estado, categoria_id, id)`
- Orden por `p.id DESC`.

9. Fallo de imagen no rompe UI:
- Si falla una imagen, se muestra fallback (`Sin imagen`) y la UI sigue fluida.

## Checklist de version estable (Web + Back)

Usar esta lista antes de cerrar una sesion y hacer deploy:

1. Flujo de auth web:
- Login, registro y logout funcionando.
- `recordar credenciales` solo precompleta (no auto-login).

2. Catalogo:
- `Productos` muestra solo estado `activo`.
- `Actualizar` muestra solo estado `inactivo`.
- Busqueda y filtro por categoria responden rapido.

3. Imagenes:
- Se cargan desde `ops_producto.imagen` mediante endpoint:
  `GET /api/web/products/:productId/image`.
- Sin dependencias Cloudinary activas en el backend.

4. Performance:
- Listado sin blob en JSON (usa `has_local_image` + `image_path`).
- Cache backend para productos/categorias activa.
- Indices vigentes: `idx_producto_estado` y `idx_producto_estado_categoria_id`.

5. Paginacion:
- Catalogo con paginacion por `limit/offset`.
- `Actualizar` con paginacion real y boton `Cargar mas`.

6. Build y calidad minima:
- Back: `npm run lint` OK.
- Web: `npm run build` OK.

## Rollback de velocidad estable

Referencia para volver al punto estable anterior al ajuste de carga progresiva del catalogo.

- Repo: `WebAgente`
- Branch: `main`
- Commit estable: `5850742` (`refactor(web): centralize catalog paging constants`)
- Commit del cambio de carga progresiva: `f14c91f` (`perf(catalog): load first page fast and hydrate remaining pages in background`)

Comportamiento tecnico:
- En `5850742`: bootstrap mas bloqueante (carga mas paginas antes de mostrar completo).
- En `f14c91f`: primera pagina rapida + hidratacion en background.

## Estado funcional actual

- Registro/login web habilitado.
- Catalogo activo con filtro por categoria, busqueda y carga de imagenes por batch + fallback.
- Carrito y envio de pedido funcionando.
- Mis pedidos (detalle, estado y ocultar pedido entregado) funcionando.
- Historial (repetir/seleccionar productos frecuentes) funcionando.
- Integracion WhatsApp manual (turno manana/noche) funcionando.
