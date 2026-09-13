BEGIN;

INSERT INTO roles (
    nombre,
    descripcion,
    activo
)
VALUES
(
    'Administrador',
    'Usuario con permisos de gestión administrativa del sistema.',
    TRUE
),
(
    'Funcionario',
    'Usuario que puede ingresar y consultar sus propias solicitudes y permisos.',
    TRUE
)
ON CONFLICT (nombre)
DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo;


INSERT INTO unidades (
    nombre,
    descripcion,
    activo
)
VALUES
(
    'Administración',
    'Unidad responsable de procesos administrativos y gestión interna.',
    TRUE
),
(
    'Asistentes',
    'Unidad encargada del apoyo a la convivencia, control y seguimiento de estudiantes.',
    TRUE
),
(
    'Docencia',
    'Unidad asociada al personal docente del establecimiento.',
    TRUE
)
ON CONFLICT (nombre)
DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo;


INSERT INTO tipos_permiso (
    nombre,
    descripcion,
    unidad_control,
    requiere_horario,
    activo
)
VALUES
(
    'Permiso Administrativo',
    'Permiso administrativo controlado principalmente por días.',
    'DIAS',
    FALSE,
    TRUE
),
(
    'Permiso por Horas',
    'Permiso solicitado por un rango horario dentro de la jornada.',
    'HORAS',
    TRUE,
    TRUE
),
(
    'Comisión de Servicio',
    'Permiso asociado a actividades institucionales fuera del establecimiento.',
    'DIAS',
    FALSE,
    TRUE
)
ON CONFLICT (nombre)
DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    unidad_control = EXCLUDED.unidad_control,
    requiere_horario = EXCLUDED.requiere_horario,
    activo = EXCLUDED.activo;


INSERT INTO estados_solicitud (
    nombre,
    descripcion
)
VALUES
(
    'Pendiente',
    'Solicitud registrada y pendiente de revisión administrativa.'
),
(
    'Aprobada',
    'Solicitud aprobada por el administrador.'
),
(
    'Rechazada',
    'Solicitud rechazada por el administrador.'
)
ON CONFLICT (nombre)
DO UPDATE SET
    descripcion = EXCLUDED.descripcion;


COMMIT;