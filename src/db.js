/**
 * Capa de almacenamiento.
 * - Si existe la variable DATABASE_URL usa PostgreSQL (Supabase en la nube).
 * - Si no, guarda en data/estudiantes.json (solo para desarrollo local).
 */
const fs = require('fs/promises');
const path = require('path');

class CarneDuplicadoError extends Error {
  constructor(carne) {
    super('Ya existe un estudiante registrado con el carné ' + carne + '.');
    this.name = 'CarneDuplicadoError';
  }
}

async function crearPostgres(connectionString) {
  const { Pool, types } = require('pg');
  // Devolver las columnas DATE como texto 'YYYY-MM-DD' (sin conversión de zona horaria).
  types.setTypeParser(1082, (v) => v);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase exige SSL
    max: 5
  });

  const esquema = await fs.readFile(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  await pool.query(esquema);

  const COLUMNAS = `carne, nombres, apellidos, correo, carrera, telefono,
    fecha_nacimiento AS "fechaNacimiento", genero, fecha_registro AS "fechaRegistro"`;

  return {
    tipo: 'PostgreSQL (' + new URL(connectionString).hostname + ')',
    async listar() {
      const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM estudiantes ORDER BY fecha_registro DESC`);
      return rows;
    },
    async insertar(e) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO estudiantes (carne, nombres, apellidos, correo, carrera, telefono, fecha_nacimiento, genero)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING ${COLUMNAS}`,
          [e.carne, e.nombres, e.apellidos, e.correo, e.carrera, e.telefono, e.fechaNacimiento, e.genero]
        );
        return rows[0];
      } catch (err) {
        if (err && err.code === '23505') throw new CarneDuplicadoError(e.carne);
        throw err;
      }
    }
  };
}

async function crearArchivo() {
  const archivo = path.join(__dirname, '..', 'data', 'estudiantes.json');
  await fs.mkdir(path.dirname(archivo), { recursive: true });

  async function leer() {
    try {
      return JSON.parse(await fs.readFile(archivo, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  // Cola para que dos POST simultáneos no se pisen al escribir el archivo.
  let cola = Promise.resolve();

  return {
    tipo: 'Archivo local (data/estudiantes.json)',
    async listar() {
      await cola;
      const lista = await leer();
      return lista.sort((a, b) => (a.fechaRegistro < b.fechaRegistro ? 1 : -1));
    },
    insertar(estudiante) {
      const tarea = cola.then(async () => {
        const lista = await leer();
        if (lista.some((e) => e.carne === estudiante.carne)) {
          throw new CarneDuplicadoError(estudiante.carne);
        }
        const nuevo = { ...estudiante, fechaRegistro: new Date().toISOString() };
        lista.push(nuevo);
        await fs.writeFile(archivo, JSON.stringify(lista, null, 2), 'utf8');
        return nuevo;
      });
      cola = tarea.catch(() => {});
      return tarea;
    }
  };
}

async function conectar() {
  const url = process.env.DATABASE_URL;
  return url ? crearPostgres(url) : crearArchivo();
}

module.exports = { conectar, CarneDuplicadoError };
