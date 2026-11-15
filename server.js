/**
 * Web service de registro de estudiantes.
 *   POST /api/estudiantes   -> registra un estudiante (requiere token reCAPTCHA)
 *   GET  /api/estudiantes   -> lista todos los estudiantes registrados
 *   GET  /api/config        -> configuración pública para el frontend (site key de reCAPTCHA)
 */
const path = require('path');
const express = require('express');
const Validacion = require('./public/js/validacion.js');
const { conectar, CarneDuplicadoError } = require('./src/db');

// Claves de PRUEBA oficiales de Google: el captcha siempre pasa.
// En producción configura RECAPTCHA_SITE_KEY y RECAPTCHA_SECRET_KEY con tus claves reales.
const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

const PORT = process.env.PORT || 3000;
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || RECAPTCHA_TEST_SITE_KEY;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || RECAPTCHA_TEST_SECRET_KEY;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim());

async function verificarRecaptcha(token, ip) {
  const params = new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token });
  if (ip) params.append('remoteip', ip);
  const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await resp.json();
  return data.success === true;
}

async function main() {
  const db = await conectar();
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  // CORS: permite consumir el web service desde otro dominio (configurable con CORS_ORIGINS).
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (CORS_ORIGINS.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && CORS_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/config', (req, res) => {
    res.json({
      recaptchaSiteKey: RECAPTCHA_SITE_KEY,
      recaptchaModoPrueba: RECAPTCHA_SITE_KEY === RECAPTCHA_TEST_SITE_KEY
    });
  });

  app.get('/api/estudiantes', async (req, res, next) => {
    try {
      const estudiantes = await db.listar();
      res.json({ total: estudiantes.length, estudiantes });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/estudiantes', async (req, res, next) => {
    try {
      const body = req.body || {};

      // Honeypot: campo oculto que una persona nunca llena.
      if (body.website) {
        return res.status(400).json({ mensaje: 'Solicitud rechazada.' });
      }

      const { valido, errores, datos } = Validacion.validarEstudiante(body);
      if (!valido) {
        return res.status(422).json({ mensaje: 'Hay campos con errores.', errores });
      }

      const token = body.recaptchaToken;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ mensaje: 'Debes completar la verificación reCAPTCHA.' });
      }
      if (!(await verificarRecaptcha(token, req.ip))) {
        return res.status(400).json({ mensaje: 'La verificación reCAPTCHA falló. Inténtalo de nuevo.' });
      }

      const estudiante = await db.insertar(datos);
      res.status(201).json({ mensaje: 'Estudiante registrado correctamente.', estudiante });
    } catch (err) {
      if (err instanceof CarneDuplicadoError) {
        return res.status(409).json({ mensaje: err.message, errores: { carne: err.message } });
      }
      next(err);
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada.' }));

  app.use(express.static(path.join(__dirname, 'public')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ mensaje: 'El cuerpo de la solicitud no es JSON válido.' });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  });

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
    console.log(`Almacenamiento: ${db.tipo}`);
    if (RECAPTCHA_SITE_KEY === RECAPTCHA_TEST_SITE_KEY) {
      console.log('reCAPTCHA: usando claves de PRUEBA de Google (configura las tuyas para producción).');
    }
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
