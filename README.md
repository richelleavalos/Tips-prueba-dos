# Tips — tienda digital y portafolio

Aplicación full-stack de Tips Arquitectura, Diseño y Productos desarrollada con HTML, CSS y JavaScript puros, Python (biblioteca estándar) y SQLite.

## Probar la versión actual

Desde la carpeta del repositorio en VS Code:

```powershell
git pull
.\.venv\Scripts\Activate.ps1
python app.py
```

Abre `http://127.0.0.1:8000`.

Si ya tienes el servidor abierto cuando haces `git pull`, detenlo con `Ctrl+C` y vuelve a ejecutar `python app.py`.

SQLite se crea automáticamente en `data/tips.db`. En una base vacía se cargan productos y proyectos de demostración para poder probar los flujos.

## Pantallas disponibles

- `/` — inicio editorial basado en los wireframes de Tips.
- `/tienda.html` — catálogo dinámico, filtros, búsqueda, ordenamiento y vista rápida.
- `/arquitectura.html` — portafolio filtrable, servicios y proceso.
- `/proyecto.html?id=1` — ficha detallada de proyecto.
- `/contacto.html` — solicitud de cotización guardada en SQLite.
- `/cuenta.html` — registro e inicio de sesión con email/contraseña.
- `/checkout.html` — checkout de prueba; exige una cuenta iniciada.
- `/admin/` — dashboard protegido para administradores.

El carrito aparece como panel lateral y solo ocupa la pantalla completa cuando el usuario lo solicita o entra al checkout.

## Crear las dos cuentas administradoras

No existe registro público de administradores. Crea cada cuenta desde la terminal:

```powershell
python scripts/create_admin.py
```

Introduce correo, nombre y una contraseña de al menos 12 caracteres. Luego inicia sesión en `/cuenta.html` y abre `/admin/`.

## Estructura de vistas

Las vistas están agrupadas por responsabilidad: `public/` contiene el sitio público, `admin/` el panel administrativo y `user/` el área privada del cliente. El servidor conserva las URLs públicas conocidas, por lo que mover los archivos no cambia enlaces externos ni favoritos existentes.

Ambos administradores tienen el mismo rol y permisos base.

## Pago

El checkout actual utiliza el proveedor `mock`. Sirve para probar carrito → autenticación → datos de envío → pedido → pago simulado → actualización de inventario → dashboard, pero **no procesa tarjetas reales**.

La integración real se conectará cuando se defina la pasarela de pago. La moneda del sistema es USD.

## Autenticación

Actualmente funciona email + contraseña segura con PBKDF2 y bloqueo temporal después de intentos fallidos. La arquitectura de base de datos ya contempla OAuth; el botón de Google se muestra como próximo paso porque todavía faltan las credenciales OAuth del proyecto. 2FA administrativo también queda para la etapa de integración.

## Seguridad implementada en la base actual

- CSRF por sesión para operaciones de escritura.
- CORS restringido.
- Cookies de sesión HttpOnly y SameSite.
- Contraseñas con PBKDF2-HMAC-SHA256 y salt aleatorio.
- Bloqueo temporal después de intentos fallidos de acceso.
- SQL parametrizado y claves foráneas SQLite.
- Rate limiting.
- CSP, X-Frame-Options, nosniff y otras cabeceras defensivas.
- Bloqueo del acceso web a `backend`, `data`, `sql`, `tests`, `.git` y `.github`.
- Validación de tamaños y tipos de JSON.

Antes de un despliegue público se debe completar la pasarela, HTTPS, almacenamiento de imágenes, Google OAuth/2FA, backups y revisión de seguridad de producción.

## Pruebas

```powershell
python -m unittest discover -s tests -v
```

GitHub Actions ejecuta compilación y pruebas automáticamente al hacer `push` a `tips`.

## Flujo Git + VS Code

Para recibir cambios hechos en GitHub:

```powershell
git pull
```

Para subir tus cambios desde VS Code:

```powershell
git add .
git commit -m "Descripción corta del cambio"
git push
```

Git conserva el historial, por lo que no necesitas crear carpetas o archivos `v1`, `v2`, `final`, etc.

## Estado funcional

La versión actual permite probar la mayoría del recorrido público: catálogo, búsqueda, carrito, cuenta, compra simulada, portafolio y cotización. El dashboard ya muestra métricas, pedidos, cotizaciones e inventario real de SQLite y presenta en navegación todos los módulos definidos para v1. Los CRUD completos de cada módulo administrativo, carga real de imágenes/logos, Google OAuth, 2FA, promociones avanzadas, reportes completos y pasarela real son las siguientes capas de implementación.
