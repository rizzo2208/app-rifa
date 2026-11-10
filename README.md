# Rifa Master

Control de venta de números de una rifa. La app es una página estática (GitHub Pages) y **Google Sheets es la base de datos**, a través de un Google Apps Script. No hay servidor ni costo.

- **Vendedor** (PIN de vendedor): registra ventas y ve el historial y el balance.
- **Administrador** (PIN de admin): además edita y borra ventas, vacía la caja, cambia el precio y exporta a Excel.
- Cada venta guarda: fecha y hora, vendedor, cantidad de números, precio, forma de pago y cuánto fue en efectivo y cuánto en transferencia.

Los PIN viven en tu Apps Script (no en este repositorio). Sin un PIN válido el script rechaza cualquier pedido.

## Puesta en marcha (una sola vez)

1. **Hoja:** creá una hoja de Google Sheets nueva (o usá la que ya tengas para la rifa).
2. **Script:** en la hoja, **Extensiones > Apps Script**. Borrá el contenido y pegá todo [`apps-script/Code.gs`](apps-script/Code.gs).
3. **PINs:** en Apps Script, **Configuración del proyecto (engranaje) > Propiedades de la secuencia de comandos > Agregar propiedad**:
   - `PIN_ADMIN`: tu PIN de administrador.
   - `PIN_VENDEDOR`: el PIN para quienes venden.

   Usá PIN largos (8 o más caracteres): la URL del script es pública y el PIN es lo único que la protege.
4. **Implementar:** **Implementar > Nueva implementación > Aplicación web**, con *Ejecutar como: Yo* y *Quién tiene acceso: Cualquier usuario*. Autorizá los permisos y copiá la URL que termina en `/exec`.
5. **Conectar la app:** pegá esa URL en [`js/config.js`](js/config.js) (`apiUrl`), hacé commit y push.
6. **GitHub Pages:** en el repo, **Settings > Pages > Deploy from a branch > `main` / `(root)`**. La app queda en `https://<tu-usuario>.github.io/app-rifa/`.

Si más adelante cambiás `Code.gs`, hacé **Implementar > Administrar implementaciones > Editar > Nueva versión**; si no, la URL sigue usando la versión vieja.

## Probar en tu computadora

```bash
npm run dev     # http://localhost:3006  (PIN vendedor 1111, PIN admin 9999)
npm test        # prueba el Code.gs real contra una hoja simulada
```

El servidor local ejecuta el mismo `Code.gs` contra una hoja simulada en memoria, así que no toca tu cuenta de Google. Los datos se pierden al detenerlo.

## Notas

- "Vaciar Caja" borra todas las ventas de la hoja (deja los encabezados). Exportá el Excel antes.
- La hoja se puede mirar y descargar desde Drive en cualquier momento; si editás filas a mano respetá las columnas y no cambies el ID.
- La versión anterior, con servidor Node y login por usuario, quedó en la rama `node-version`.
