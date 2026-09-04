# Despacho servicio técnico

App educativa (INACAP) para que jefatura arme rutas y el técnico consulte su jornada sin llamar.

No usa base de datos: todo vive en `localStorage` del navegador. Hay datos de demo para presentar de inmediato.

## Cómo usar

1. Entra y elige **Jefatura** o **Técnico**.
2. Jefatura: arma paradas (día + encargado + locación). El ID se reutiliza si esa pareja ya existe.
3. Jefatura: asigna técnicos y camioneta. Los viáticos se calculan en el encargado.
4. Técnico: elige su nombre y ve el orden de locaciones.

## Local

```bash
npm install
npm run dev
```

## Vercel

El proyecto se puede publicar con `npx vercel --yes --prod`.
