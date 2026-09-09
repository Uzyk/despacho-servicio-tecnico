# Despacho servicio técnico

App educativa (INACAP) para que jefatura arme rutas y el técnico consulte su jornada sin llamar.

No usa base de datos: todo vive en `localStorage` del navegador. Hay datos de demo para presentar de inmediato.

## Cómo usar

1. Entra y elige **Jefatura** o **Técnico**.
2. Jefatura: en **Armar** solo arma el itinerario (fecha, locación, tipo y hora). Las rutas aparecen en **Calendario**.
3. Jefatura: en **Cuadrilla** asigna encargado, vehículo operativo y quién hace cada parada. Los viáticos se calculan en el encargado.
4. Técnico: en traslado o pernocte solo marca Llegué. En el trabajo marca llegada, tareas y salida.
5. Jefatura: en **En vivo** ves el mapa GPS de cada técnico, puedes reemplazar a quien falle y finalizar la ruta.
6. **Desempeño** guarda el registro de cada técnico. **Historial** guarda las rutas ya cerradas.

## Local

```bash
npm install
npm run dev
```

## Publicar en Vercel

1. Entra a [vercel.com/new](https://vercel.com/new).
2. Importa el repo `Uzyk/despacho-servicio-tecnico`.
3. Framework: Next.js. Deploy.

Repositorio: https://github.com/Uzyk/despacho-servicio-tecnico
