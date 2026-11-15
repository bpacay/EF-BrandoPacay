# Registro de Estudiantes

Formulario de registro de estudiantes con un **web service REST en la nube** (método `POST`), una ventana de **consulta** con buscador y botón de actualizar, y protección anti-bots con **Google reCAPTCHA v2** + campo honeypot.

- **Backend:** Node.js + Express (`server.js`)
- **Base de datos:** Supabase (PostgreSQL en la nube). Sin `DATABASE_URL`, usa `data/estudiantes.json` para pruebas locales.
- **Frontend:** HTML, CSS y JavaScript sin frameworks (`public/`)
- **Hosting sugerido:** Render (plan gratuito) usando `render.yaml`

## Estructura

```
server.js               Web service (Express): POST/GET /api/estudiantes, GET /api/config
src/db.js               Almacenamiento: PostgreSQL (Supabase) o archivo JSON local
sql/schema.sql          Tabla "estudiantes" (el servidor la crea sola al iniciar)
public/index.html       Formulario de registro
public/consulta.html    Ventana de consulta (tabla + buscador + actualizar)
public/js/validacion.js Reglas de validación (las usan el navegador Y el servidor)
public/js/registro.js   Lógica del formulario, reCAPTCHA y envío POST
public/js/consulta.js   Carga, búsqueda y resaltado de estudiantes
public/js/config.js     URL del API si el frontend se publica en otro dominio
render.yaml             Despliegue en Render
.env.example            Variables de entorno
```

## Campos y validaciones

| Campo | Tipo | Regla |
|---|---|---|
| Carné | text | mínimo 8 caracteres, solo letras y números (se guarda en mayúsculas, único) |
| Nombres | text | solo letras (incluye tildes y ñ) y espacios |
| Apellidos | text | solo letras (incluye tildes y ñ) y espacios |
| Correo | email | formato de correo válido |
| Carrera | select | Ingeniería en Sistemas, Ingeniería Industrial, Administración de Empresas, Contaduría Pública, Psicología, Ingeniería Civil |
| Teléfono | tel | formato `XXXX-XXXX` (el guion se agrega solo al escribir) |
| Fecha de nacimiento | date | edad mínima de 16 años |
| Género | radio | Femenino / Masculino / Otro |

- El botón **Registrar** permanece **deshabilitado** hasta que todos los campos son válidos **y** el reCAPTCHA está marcado.
- El servidor **vuelve a validar** todo y verifica el token de reCAPTCHA con Google antes de guardar, así que no se puede saltar la validación llamando al API directamente.

## Ejecutar localmente

Requiere Node.js 22.9 o superior.

```bash
npm install
```

```bash
npm start
```

Abre http://localhost:3000. La conexión a la base se lee de `.env` (`DATABASE_URL`, ver `.env.example`; el `.env` no se sube a Git). Si no hay `DATABASE_URL` los datos se guardan en `data/estudiantes.json`. Sin claves de reCAPTCHA se usan las **claves de prueba** de Google (siempre aprueban y muestran un aviso rojo).

## Despliegue en la nube (gratis)

### 1. Base de datos: Supabase
1. La tabla `estudiantes` se crea automáticamente la primera vez que arranca el servidor (`sql/schema.sql`). Tiene restricciones `CHECK`, carné `UNIQUE` y **RLS activado**, así que la API pública de Supabase (clave anon) no puede leer ni modificar los datos; solo el web service.
2. Para Render usa la cadena del **Session pooler** (Supabase → *Connect* → *Session pooler*), que funciona por IPv4. La conexión directa `db.<proyecto>.supabase.co` es solo IPv6 y Render no la alcanza. Tiene esta forma:
   `postgresql://postgres.<proyecto>:<contraseña>@aws-0-<region>.pooler.supabase.com:5432/postgres`
3. Si la contraseña tiene caracteres especiales, codifícalos en la URL: `%` → `%25`, `@` → `%40`, `#` → `%23`, `/` → `%2F`.

### 2. Claves de reCAPTCHA
1. Entra a https://www.google.com/recaptcha/admin y crea un sitio de tipo **reCAPTCHA v2 → Casilla "No soy un robot"**.
2. En *Dominios* agrega `localhost` y el dominio de Render (ej. `registro-estudiantes.onrender.com`).
3. Copia la **clave del sitio** y la **clave secreta**.

### 3. Web service: Render
1. Sube este proyecto a un repositorio de GitHub.
2. En https://render.com elige **New → Blueprint** y selecciona el repositorio (Render lee `render.yaml`).
3. Completa las variables de entorno:
   - `DATABASE_URL` = cadena del Session pooler de Supabase
   - `RECAPTCHA_SITE_KEY` = clave del sitio
   - `RECAPTCHA_SECRET_KEY` = clave secreta
4. Al terminar el despliegue, la app queda en `https://<tu-servicio>.onrender.com`.

> En el plan gratuito de Render el servicio se "duerme" tras 15 minutos sin uso; la primera petición puede tardar unos 30–50 segundos.

## API

### `POST /api/estudiantes`

```json
{
  "carne": "0901202312345",
  "nombres": "María José",
  "apellidos": "López Pérez",
  "correo": "maria@correo.com",
  "carrera": "Psicología",
  "telefono": "5555-1234",
  "fechaNacimiento": "2000-05-10",
  "genero": "Femenino",
  "recaptchaToken": "<token devuelto por reCAPTCHA>"
}
```

| Código | Significado |
|---|---|
| `201` | Registrado. Devuelve `{ mensaje, estudiante }` |
| `400` | Falta el reCAPTCHA, el reCAPTCHA no es válido o lo detectó el honeypot |
| `409` | Ya existe un estudiante con ese carné |
| `422` | Datos no válidos. Devuelve `{ mensaje, errores: { campo: "mensaje" } }` |

### `GET /api/estudiantes`

Devuelve `{ total, estudiantes: [...] }`, del registro más reciente al más antiguo. Cada estudiante incluye todos los campos guardados más `fechaRegistro`.

### `GET /api/config`

Devuelve la clave pública (site key) de reCAPTCHA que usa el formulario.
