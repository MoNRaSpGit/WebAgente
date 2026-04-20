# WebAgente

Frontend web publico separado de `FrontAgente`.

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
