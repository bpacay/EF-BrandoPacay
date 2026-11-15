-- Tabla de estudiantes (Supabase / PostgreSQL).
-- El servidor la crea automáticamente al iniciar; este archivo es de referencia
-- o para ejecutarlo manualmente en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS estudiantes (
  id               SERIAL PRIMARY KEY,
  carne            VARCHAR(20)  NOT NULL UNIQUE CHECK (carne ~ '^[A-Z0-9]{8,20}$'),
  nombres          VARCHAR(60)  NOT NULL,
  apellidos        VARCHAR(60)  NOT NULL,
  correo           VARCHAR(100) NOT NULL,
  carrera          VARCHAR(60)  NOT NULL CHECK (carrera IN (
                     'Ingeniería en Sistemas', 'Ingeniería Industrial', 'Administración de Empresas',
                     'Contaduría Pública', 'Psicología', 'Ingeniería Civil')),
  telefono         CHAR(9)      NOT NULL CHECK (telefono ~ '^[0-9]{4}-[0-9]{4}$'),
  fecha_nacimiento DATE         NOT NULL,
  genero           VARCHAR(10)  NOT NULL CHECK (genero IN ('Femenino', 'Masculino', 'Otro')),
  fecha_registro   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Bloquea el acceso a la tabla desde la API pública de Supabase (clave anon).
-- El web service se conecta como "postgres", que no está sujeto a RLS.
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
