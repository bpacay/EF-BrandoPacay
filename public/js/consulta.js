(function () {
  'use strict';

  const API = (window.API_BASE || '') + '/api';

  const tbody = document.getElementById('tbody');
  const buscador = document.getElementById('buscador');
  const btnActualizar = document.getElementById('btnActualizar');
  const icono = document.getElementById('iconoActualizar');
  const contador = document.getElementById('contador');
  const alerta = document.getElementById('alerta');

  const COLUMNAS = ['carne', 'nombres', 'apellidos', 'correo', 'carrera', 'telefono', 'fechaNacimiento', 'genero', 'fechaRegistro'];

  let estudiantes = [];

  // Quita tildes y pasa a minúsculas para que la búsqueda no distinga "Psicología" de "psicologia".
  function plano(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function formatearFecha(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }

  function formatearFechaHora(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || '';
    return d.toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function textoColumna(est, col) {
    if (col === 'fechaNacimiento') return formatearFecha(est[col]);
    if (col === 'fechaRegistro') return formatearFechaHora(est[col]);
    return est[col] == null ? '' : String(est[col]);
  }

  /** Crea una celda resaltando la coincidencia de búsqueda (sin usar innerHTML con datos). */
  function celda(texto, termino) {
    const td = document.createElement('td');
    if (!termino) {
      td.textContent = texto;
      return td;
    }
    const idx = plano(texto).indexOf(termino);
    if (idx === -1) {
      td.textContent = texto;
      return td;
    }
    td.appendChild(document.createTextNode(texto.slice(0, idx)));
    const mark = document.createElement('mark');
    mark.textContent = texto.slice(idx, idx + termino.length);
    td.appendChild(mark);
    td.appendChild(document.createTextNode(texto.slice(idx + termino.length)));
    return td;
  }

  function filaVacia(mensaje) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = COLUMNAS.length + 1;
    td.className = 'empty';
    td.textContent = mensaje;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function render() {
    const termino = plano(buscador.value.trim());
    const filtrados = termino
      ? estudiantes.filter(function (est) {
          return COLUMNAS.some(function (col) { return plano(textoColumna(est, col)).indexOf(termino) !== -1; });
        })
      : estudiantes;

    contador.textContent = termino
      ? filtrados.length + ' de ' + estudiantes.length + ' estudiantes'
      : estudiantes.length + (estudiantes.length === 1 ? ' estudiante' : ' estudiantes');

    if (estudiantes.length === 0) return filaVacia('Aún no hay estudiantes registrados.');
    if (filtrados.length === 0) return filaVacia('Ningún estudiante coincide con "' + buscador.value.trim() + '".');

    const frag = document.createDocumentFragment();
    filtrados.forEach(function (est, i) {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.className = 'num';
      num.textContent = i + 1;
      tr.appendChild(num);
      COLUMNAS.forEach(function (col) { tr.appendChild(celda(textoColumna(est, col), termino)); });
      frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
  }

  async function cargar() {
    btnActualizar.disabled = true;
    icono.classList.add('spin');
    alerta.hidden = true;
    try {
      const resp = await fetch(API + '/estudiantes', { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      estudiantes = Array.isArray(data.estudiantes) ? data.estudiantes : [];
      render();
    } catch (err) {
      alerta.textContent = 'No se pudieron cargar los estudiantes: ' + err.message + '. Presiona "Actualizar" para reintentar.';
      alerta.hidden = false;
      if (estudiantes.length === 0) filaVacia('Sin datos.');
    } finally {
      btnActualizar.disabled = false;
      icono.classList.remove('spin');
    }
  }

  buscador.addEventListener('input', render);
  btnActualizar.addEventListener('click', cargar);

  cargar();
})();
