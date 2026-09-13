# PermiGest LBSC

Sistema web para la gestión de solicitudes y permisos del personal del
Liceo Bicentenario Santa Cruz.

PermiGest LBSC centraliza el registro, revisión, seguimiento y análisis
de permisos administrativos, incorporando perfiles diferenciados,
trazabilidad de operaciones, estadísticas y mecanismos de seguridad.

## Características principales

- Autenticación de usuarios.
- Perfiles Funcionario y Administrador.
- Registro de solicitudes de permisos.
- Aprobación y rechazo de solicitudes.
- Historial de solicitudes.
- Registro de permisos aprobados.
- Gestión de funcionarios y cuentas de acceso.
- Activación e inactivación de usuarios.
- Perfil de usuario y actualización de datos personales.
- Cambio seguro de contraseña.
- Recuperación de contraseña mediante correo electrónico.
- Control de intentos mediante limitación de solicitudes.
- Dashboard con indicadores.
- Estadísticas históricas.
- Registro de auditoría y trazabilidad.
- Diseño web responsive.
- Control de acceso basado en roles.

## Tecnologías

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Python
- Flask
- Flask-JWT-Extended
- Flask-Limiter
- Werkzeug

### Base de datos

- PostgreSQL
- Psycopg

### Desarrollo y despliegue

- Visual Studio Code
- Git
- GitHub
- Gunicorn
- Render

## Arquitectura

PermiGest LBSC utiliza una arquitectura web organizada por capas:

1. Capa de presentación: HTML, CSS y JavaScript.
2. Capa de aplicación: Flask y API REST.
3. Capa de lógica y seguridad: validaciones, autenticación, roles y auditoría.
4. Capa de acceso a datos: Psycopg.
5. Capa de persistencia: PostgreSQL.

## Perfiles de usuario

### Funcionario

Puede:

- Registrar solicitudes.
- Consultar sus solicitudes.
- Consultar permisos aprobados.
- Revisar su historial.
- Consultar y modificar datos personales.
- Cambiar su contraseña.

### Administrador

Además de las funciones generales de consulta, puede:

- Revisar solicitudes de funcionarios.
- Aprobar o rechazar solicitudes.
- Gestionar funcionarios.
- Activar o desactivar cuentas.
- Consultar estadísticas institucionales.
- Consultar registros de auditoría.

## Seguridad

El sistema incorpora:

- Contraseñas almacenadas mediante hash.
- Autenticación mediante JWT.
- Control de acceso por roles.
- Consultas SQL parametrizadas.
- Validación de datos en frontend y backend.
- Limitación de intentos en operaciones sensibles.
- Recuperación de contraseña mediante token temporal.
- Invalidación del token después del cambio de contraseña.
- Variables de entorno para información sensible.
- Registro de auditoría con usuario, acción, fecha e IP.

## Estructura del proyecto

```text
PermiGest_LBSC/
├── database/
│   ├── schema.sql
│   └── seed.sql
├── static/
│   ├── css/
│   │   └── styles.css
│   └── js/
├── templates/
├── .env.example
├── .gitignore
├── app.py
├── configurar_password.py
├── requirements.txt
└── README.md