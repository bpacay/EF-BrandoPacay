(function () {
  'use strict';

  const V = window.Validacion;
  const API = (window.API_BASE || '') + '/api';

  const form = document.getElementById('formRegistro');
  const btnRegistrar = document.getElementById('btnRegistrar');
  const btnLimpiar = document.getElementById('btnLimpiar');
  const estadoBoton = document.getElementById('estadoBoton');
  const alerta = document.getElementById('alerta');
  const captchaNota = document.getElementById('captchaNota');
  const selCarrera = document.getElementById('carrera');
  const inpFecha = document.getElementById('fechaNacimiento');
  const inpTelefono = document.getElementById('telefono');

  const tocados = new Set();
  let captchaToken = null;
  let captchaId = null;
  let enviando = false;

  // ---------- Inicialización de controles ----------
  V.CARRERAS.forEach(function (c) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    selCarrera.appendChild(opt);
  });

  inpFecha.max = V.fechaMaximaNacimiento();
  inpFecha.min = V.fechaMinimaNacimiento();

  // ---------- Lectura de valores ----------
  function valorDe(campo) {
    if (campo === 'genero') {
      const marcado = form.querySelector('input[name="genero"]:checked');
      return marcado ? marcado.value : '';
    }
    return form.elements[campo].value;
  }

  function leerFormulario() {
    const datos = {};
    V.CAMPOS.forEach(function (c) { datos[c] = valorDe(c); });
    return datos;
  }

  // ---------- Validación y UI ----------
  function pintarCampo(campo, error) {
    const cont = form.querySelector('[data-campo="' + campo + '"]');
    const msg = document.getElementById(campo + '-error');
    const mostrar = tocados.has(campo);
    cont.classList.toggle('invalid', mostrar && !!error);
    cont.classList.toggle('valid', mostrar && !error);
    msg.textContent = mostrar ? error : '';
    const control = campo === 'genero' ? null : form.elements[campo];
    if (control) control.setAttribute('aria-invalid', mostrar && error ? 'true' : 'false');
  }

  function validarTodo() {
    const datos = leerFormulario();
    let invalidos = 0;
    V.CAMPOS.forEach(function (campo) {
      const error = V.validarCampo(campo, datos[campo]);
      if (error) invalidos++;
      pintarCampo(campo, error);
    });
    actualizarBoton(invalidos);
  }

  function actualizarBoton(invalidos) {
    const listo = invalidos === 0 && !!captchaToken && !enviando;
    btnRegistrar.disabled = !listo;
    if (enviando) {
      estadoBoton.textContent = '';
    } else if (invalidos > 0) {
      estadoBoton.textContent = invalidos === 1 ? 'Falta 1 campo por completar correctamente.' : 'Faltan ' + invalidos + ' campos por completar correctamente.';
    } else if (!captchaToken) {
      estadoBoton.textContent = 'Completa la verificación "No soy un robot".';
    } else {
      estadoBoton.textContent = 'Todo listo para enviar.';
    }
  }

  function marcarTocado(e) {
    const campo = e.target.name;
    if (V.CAMPOS.indexOf(campo) !== -1) tocados.add(campo);
  }

  // Formato automático del teléfono: solo dígitos y guion después del 4.º dígito.
  inpTelefono.addEventListener('input', function () {
    const digitos = inpTelefono.value.replace(/\D/g, '').slice(0, 8);
    inpTelefono.value = digitos.length > 4 ? digitos.slice(0, 4) + '-' + digitos.slice(4) : digitos;
  });

  form.addEventListener('input', function (e) {
    // En campos de texto se marca como tocado al escribir algo.
    if (e.target.value) marcarTocado(e);
    validarTodo();
  });
  form.addEventListener('change', function (e) { marcarTocado(e); validarTodo(); });
  form.addEventListener('focusout', function (e) { marcarTocado(e); validarTodo(); });

  // ---------- reCAPTCHA ----------
  let resolverRecaptcha;
  const recaptchaListo = new Promise(function (r) { resolverRecaptcha = r; });
  window.onRecaptchaLoad = function () { resolverRecaptcha(); };

  const configLista = fetch(API + '/config').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });

  Promise.all([configLista, recaptchaListo])
    .then(function (res) {
      const config = res[0];
      captchaId = grecaptcha.render('recaptcha', {
        sitekey: config.recaptchaSiteKey,
        callback: function (token) { captchaToken = token; validarTodo(); },
        'expired-callback': function () { captchaToken = null; validarTodo(); },
        'error-callback': function () { captchaToken = null; validarTodo(); }
      });
      captchaNota.textContent = config.recaptchaModoPrueba
        ? 'reCAPTCHA en modo de prueba (claves de desarrollo de Google).'
        : 'Protegido por reCAPTCHA de Google.';
    })
    .catch(function () {
      captchaNota.textContent = 'No se pudo cargar el reCAPTCHA. Revisa tu conexión y recarga la página.';
    });

  function reiniciarCaptcha() {
    captchaToken = null;
    if (captchaId !== null && window.grecaptcha) grecaptcha.reset(captchaId);
  }

  // ---------- Alertas ----------
  function mostrarAlerta(tipo, html) {
    alerta.className = 'alert alert-' + tipo;
    alerta.innerHTML = html;
    alerta.hidden = false;
    alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function escapar(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function limpiarFormulario() {
    form.reset();
    tocados.clear();
    reiniciarCaptcha();
    validarTodo();
  }

  btnLimpiar.addEventListener('click', function () {
    alerta.hidden = true;
    limpiarFormulario();
  });

  // ---------- Envío (POST) ----------
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    V.CAMPOS.forEach(function (c) { tocados.add(c); });

    const { valido } = V.validarEstudiante(leerFormulario());
    if (!valido || !captchaToken || enviando) {
      validarTodo();
      return;
    }

    const payload = Object.assign(leerFormulario(), {
      website: form.elements.website.value,
      recaptchaToken: captchaToken
    });

    enviando = true;
    const textoOriginal = btnRegistrar.textContent;
    btnRegistrar.innerHTML = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg> Registrando…';
    validarTodo();

    try {
      const resp = await fetch(API + '/estudiantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(function () { return {}; });

      if (resp.ok) {
        const est = data.estudiante;
        mostrarAlerta('success',
          '<strong>¡Registro exitoso!</strong> ' + escapar(est.nombres + ' ' + est.apellidos) +
          ' (carné ' + escapar(est.carne) + ') fue registrado. <a href="consulta.html">Ver estudiantes registrados</a>');
        limpiarFormulario();
      } else {
        if (data.errores) {
          Object.keys(data.errores).forEach(function (campo) {
            if (V.CAMPOS.indexOf(campo) === -1) return;
            tocados.add(campo);
            const cont = form.querySelector('[data-campo="' + campo + '"]');
            cont.classList.add('invalid');
            cont.classList.remove('valid');
            document.getElementById(campo + '-error').textContent = data.errores[campo];
          });
        }
        mostrarAlerta('error', '<strong>No se pudo registrar.</strong> ' + escapar(data.mensaje || ('Error ' + resp.status)));
        reiniciarCaptcha();
      }
    } catch (err) {
      mostrarAlerta('error', '<strong>Error de conexión.</strong> No se pudo contactar al servidor. Inténtalo de nuevo.');
      reiniciarCaptcha();
    } finally {
      enviando = false;
      btnRegistrar.textContent = textoOriginal;
      actualizarBotonSinRepintar();
    }
  });

  // Tras un error del servidor (p. ej. carné duplicado) no repintamos para conservar el mensaje del API.
  function actualizarBotonSinRepintar() {
    const datos = leerFormulario();
    const invalidos = V.CAMPOS.filter(function (c) { return V.validarCampo(c, datos[c]); }).length;
    actualizarBoton(invalidos);
  }

  validarTodo();
})();
