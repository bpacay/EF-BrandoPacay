/**
 * Reglas de validación compartidas entre el navegador y el servidor.
 * En el navegador queda disponible como `window.Validacion`;
 * en Node se importa con `require('./public/js/validacion.js')`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Validacion = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CARRERAS = [
    'Ingeniería en Sistemas',
    'Ingeniería Industrial',
    'Administración de Empresas',
    'Contaduría Pública',
    'Psicología',
    'Ingeniería Civil'
  ];

  const GENEROS = ['Femenino', 'Masculino', 'Otro'];

  const EDAD_MINIMA = 16;
  const EDAD_MAXIMA = 100;

  const RE_CARNE = /^[A-Za-z0-9]{8,20}$/;
  const RE_SOLO_LETRAS = /^[\p{L} ]+$/u;
  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_TELEFONO = /^\d{4}-\d{4}$/;
  const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

  const CAMPOS = ['carne', 'nombres', 'apellidos', 'correo', 'carrera', 'telefono', 'fechaNacimiento', 'genero'];

  /** Limpia espacios sobrantes y aplica el formato que se guarda. */
  function normalizar(campo, valor) {
    let v = valor == null ? '' : String(valor).trim();
    switch (campo) {
      case 'carne':
        return v.toUpperCase();
      case 'nombres':
      case 'apellidos':
        return v.replace(/\s+/g, ' ');
      case 'correo':
        return v.toLowerCase();
      default:
        return v;
    }
  }

  /** Devuelve la edad en años cumplidos, o NaN si la fecha no es válida. */
  function calcularEdad(fechaStr, hoy) {
    hoy = hoy || new Date();
    const m = RE_FECHA.exec(fechaStr || '');
    if (!m) return NaN;
    const anio = +m[1], mes = +m[2] - 1, dia = +m[3];
    const f = new Date(anio, mes, dia);
    if (f.getFullYear() !== anio || f.getMonth() !== mes || f.getDate() !== dia) return NaN;
    if (f > hoy) return NaN;
    let edad = hoy.getFullYear() - anio;
    const difMes = hoy.getMonth() - mes;
    if (difMes < 0 || (difMes === 0 && hoy.getDate() < dia)) edad--;
    return edad;
  }

  /** Fecha máxima permitida (hoy menos EDAD_MINIMA años) en formato YYYY-MM-DD. */
  function fechaMaximaNacimiento(hoy) {
    hoy = hoy || new Date();
    const f = new Date(hoy.getFullYear() - EDAD_MINIMA, hoy.getMonth(), hoy.getDate());
    return aISO(f);
  }

  function fechaMinimaNacimiento(hoy) {
    hoy = hoy || new Date();
    const f = new Date(hoy.getFullYear() - EDAD_MAXIMA, hoy.getMonth(), hoy.getDate());
    return aISO(f);
  }

  function aISO(f) {
    const mm = String(f.getMonth() + 1).padStart(2, '0');
    const dd = String(f.getDate()).padStart(2, '0');
    return f.getFullYear() + '-' + mm + '-' + dd;
  }

  /** Valida un campo ya normalizado. Devuelve '' si es válido o el mensaje de error. */
  function validarCampo(campo, valor) {
    const v = normalizar(campo, valor);
    switch (campo) {
      case 'carne':
        if (!v) return 'El carné es obligatorio.';
        if (!/^[A-Za-z0-9]+$/.test(v)) return 'El carné solo puede tener letras y números.';
        if (v.length < 8) return 'El carné debe tener al menos 8 caracteres.';
        if (!RE_CARNE.test(v)) return 'El carné no puede tener más de 20 caracteres.';
        return '';
      case 'nombres':
      case 'apellidos': {
        const etiqueta = campo === 'nombres' ? 'Los nombres' : 'Los apellidos';
        if (!v) return etiqueta + ' son obligatorios.';
        if (!RE_SOLO_LETRAS.test(v)) return etiqueta + ' solo pueden tener letras y espacios.';
        if (v.replace(/ /g, '').length < 2) return etiqueta + ' deben tener al menos 2 letras.';
        if (v.length > 60) return etiqueta + ' no pueden tener más de 60 caracteres.';
        return '';
      }
      case 'correo':
        if (!v) return 'El correo es obligatorio.';
        if (v.length > 100 || !RE_CORREO.test(v)) return 'Ingresa un correo válido (ej. nombre@dominio.com).';
        return '';
      case 'carrera':
        if (!v) return 'Selecciona una carrera.';
        if (CARRERAS.indexOf(v) === -1) return 'Carrera no válida.';
        return '';
      case 'telefono':
        if (!v) return 'El teléfono es obligatorio.';
        if (!RE_TELEFONO.test(v)) return 'El teléfono debe tener el formato XXXX-XXXX.';
        return '';
      case 'fechaNacimiento': {
        if (!v) return 'La fecha de nacimiento es obligatoria.';
        const edad = calcularEdad(v);
        if (isNaN(edad)) return 'Ingresa una fecha de nacimiento válida.';
        if (edad < EDAD_MINIMA) return 'Debes tener al menos ' + EDAD_MINIMA + ' años.';
        if (edad > EDAD_MAXIMA) return 'Ingresa una fecha de nacimiento válida.';
        return '';
      }
      case 'genero':
        if (!v) return 'Selecciona un género.';
        if (GENEROS.indexOf(v) === -1) return 'Género no válido.';
        return '';
      default:
        return 'Campo desconocido.';
    }
  }

  /** Valida el objeto completo. Devuelve { valido, errores, datos } con los datos normalizados. */
  function validarEstudiante(obj) {
    obj = obj || {};
    const errores = {};
    const datos = {};
    CAMPOS.forEach(function (campo) {
      datos[campo] = normalizar(campo, obj[campo]);
      const error = validarCampo(campo, datos[campo]);
      if (error) errores[campo] = error;
    });
    return { valido: Object.keys(errores).length === 0, errores: errores, datos: datos };
  }

  return {
    CARRERAS: CARRERAS,
    GENEROS: GENEROS,
    CAMPOS: CAMPOS,
    EDAD_MINIMA: EDAD_MINIMA,
    normalizar: normalizar,
    calcularEdad: calcularEdad,
    fechaMaximaNacimiento: fechaMaximaNacimiento,
    fechaMinimaNacimiento: fechaMinimaNacimiento,
    validarCampo: validarCampo,
    validarEstudiante: validarEstudiante
  };
});
