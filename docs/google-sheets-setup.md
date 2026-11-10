# Copia de ventas en Google Sheets

Cada venta que se registra, edita o borra en la app se copia automáticamente a una hoja de Google Sheets de tu cuenta. La base principal sigue siendo la de la app (volumen de Railway); la hoja es tu copia visible y descargable.

Si la hoja falla o no está configurada, la app sigue funcionando normal: el error solo queda en los logs.

## Pasos (una sola vez)

1. Creá una hoja de Google Sheets nueva, por ejemplo **Rifa - Ventas**.
2. Menú **Extensiones > Apps Script**. Borrá el contenido y pegá todo el archivo [`google-apps-script.gs`](google-apps-script.gs).
3. En Apps Script, **Configuración del proyecto (engranaje) > Propiedades de la secuencia de comandos > Agregar propiedad**:
   - Propiedad: `TOKEN`
   - Valor: una cadena larga y aleatoria (generala en tu terminal con `node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))'`).
4. **Implementar > Nueva implementación > Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Autorizá los permisos que pida Google y copiá la URL que termina en `/exec`.
5. En Railway, pestaña **Variables** del servicio, agregá:
   - `SHEETS_URL`: la URL `/exec` del paso anterior.
   - `SHEETS_TOKEN`: el mismo valor que pusiste en `TOKEN`.
6. Esperá el redeploy y registrá una venta de prueba: tiene que aparecer una fila en la pestaña **Ventas**.

## Notas

- La URL `/exec` es pública, pero sin el `TOKEN` correcto el script rechaza cualquier pedido. No subas el token al repositorio.
- Si cambiás el script, hacé **Implementar > Administrar implementaciones > Editar > Nueva versión**; si no, la URL sigue usando la versión vieja.
- "Vaciar Caja" en el panel admin también vacía la hoja (deja solo los encabezados). Exportá el Excel antes.
- Las ventas anteriores a conectar la hoja no se copian solas; editar una venta la agrega si todavía no estaba.
