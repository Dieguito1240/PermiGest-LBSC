import os
import hashlib
import hmac
import smtplib

import psycopg
from email.message import EmailMessage
from flask import Flask, jsonify, request, render_template
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from itsdangerous import (
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer
)
from psycopg.rows import dict_row
from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)


app = Flask(__name__)
app.json.ensure_ascii = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

jwt = JWTManager(app)

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["300 per hour"]
)

app.config["PASSWORD_RESET_SECRET"] = (
    os.getenv("PASSWORD_RESET_SECRET")
    or app.config["JWT_SECRET_KEY"]
)

app.config["PASSWORD_RESET_MAX_AGE"] = 1800

app.config["APP_BASE_URL"] = os.getenv(
    "APP_BASE_URL",
    "http://127.0.0.1:5000"
).rstrip("/")

app.config["SMTP_HOST"] = os.getenv("SMTP_HOST")
app.config["SMTP_PORT"] = int(
    os.getenv("SMTP_PORT", "587")
)

app.config["SMTP_USER"] = os.getenv("SMTP_USER")

smtp_password = os.getenv("SMTP_PASSWORD")
app.config["SMTP_PASSWORD"] = (
    smtp_password.replace(" ", "")
    if smtp_password
    else None
)

app.config["SMTP_FROM"] = os.getenv(
    "SMTP_FROM",
    app.config["SMTP_USER"]
)

app.config["SMTP_USE_TLS"] = (
    os.getenv(
        "SMTP_USE_TLS",
        "true"
    ).lower() == "true"
)


def conectar_bd():
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        return psycopg.connect(
            database_url,
            row_factory=dict_row
        )

    return psycopg.connect(
        host="localhost",
        port="5432",
        dbname="permigest_lbsc",
        user="postgres",
        password=os.getenv("DB_PASSWORD"),
        row_factory=dict_row
    )

def obtener_serializer_recuperacion():
    secreto = app.config["PASSWORD_RESET_SECRET"]

    if not secreto:
        raise RuntimeError(
            "PASSWORD_RESET_SECRET no está configurado."
        )

    return URLSafeTimedSerializer(
        secreto,
        salt="permigest-recuperacion-password"
    )


def generar_huella_password(password_hash):
    if not password_hash:
        raise RuntimeError(
            "El usuario no tiene un hash de contraseña válido."
        )

    return hashlib.sha256(
        str(password_hash).encode("utf-8")
    ).hexdigest()


def generar_token_recuperacion(
    id_usuario,
    password_hash
):
    serializer = obtener_serializer_recuperacion()

    return serializer.dumps({
        "id_usuario": int(id_usuario),
        "huella": generar_huella_password(
            password_hash
        )
    })


def validar_configuracion_recuperacion():
    faltantes = []

    if not app.config["PASSWORD_RESET_SECRET"]:
        faltantes.append("PASSWORD_RESET_SECRET")

    if not app.config["SMTP_HOST"]:
        faltantes.append("SMTP_HOST")

    if not app.config["SMTP_USER"]:
        faltantes.append("SMTP_USER")

    if not app.config["SMTP_PASSWORD"]:
        faltantes.append("SMTP_PASSWORD")

    if not app.config["SMTP_FROM"]:
        faltantes.append("SMTP_FROM")

    return faltantes


def enviar_correo_recuperacion(
    destinatario,
    nombre,
    enlace
):
    faltantes = validar_configuracion_recuperacion()

    if faltantes:
        raise RuntimeError(
            "Configuración de recuperación incompleta: "
            + ", ".join(faltantes)
        )

    host = app.config["SMTP_HOST"]
    puerto = app.config["SMTP_PORT"]
    usuario = app.config["SMTP_USER"]
    password = app.config["SMTP_PASSWORD"]
    remitente = app.config["SMTP_FROM"]

    mensaje = EmailMessage()
    mensaje["Subject"] = (
        "Recuperación de contraseña - PermiGest LBSC"
    )
    mensaje["From"] = remitente
    mensaje["To"] = destinatario

    mensaje.set_content(
        f"""Hola {nombre}:

Se recibió una solicitud para restablecer la contraseña de su cuenta en PermiGest LBSC.

Para crear una nueva contraseña, ingrese al siguiente enlace:

{enlace}

Este enlace tendrá una vigencia de 30 minutos.

Si usted no realizó esta solicitud, puede ignorar este mensaje.

PermiGest LBSC
Liceo Bicentenario Santa Cruz
"""
    )

    print(
        "Intentando enviar correo de recuperación a:",
        destinatario
    )
    print(
        "Servidor SMTP:",
        host,
        "Puerto:",
        puerto
    )

    with smtplib.SMTP(
        host,
        puerto,
        timeout=20
    ) as servidor:

        servidor.ehlo()

        if app.config["SMTP_USE_TLS"]:
            servidor.starttls()
            servidor.ehlo()

        servidor.login(
            usuario,
            password
        )

        rechazados = servidor.send_message(
            mensaje
        )

        if rechazados:
            raise RuntimeError(
                "El servidor SMTP rechazó uno o más destinatarios."
            )

    print(
        "Correo de recuperación enviado correctamente a:",
        destinatario
    )


@app.route("/")
def inicio():
    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/solicitudes/nueva")
def nueva_solicitud_page():
    return render_template("nueva_solicitud.html")

@app.route("/admin/solicitudes")
def solicitudes_admin_page():
    return render_template("solicitudes_admin.html")

@app.route("/api/health", methods=["GET"])
def health():
    try:
        conexion = conectar_bd()
        cursor = conexion.cursor()

        cursor.execute("SELECT 1;")
        cursor.fetchone()

        cursor.close()
        conexion.close()

        return jsonify({
            "ok": True,
            "servicio": "PermiGest LBSC API",
            "base_datos": "conectada"
        }), 200

    except Exception as error:
        print(error)
        return jsonify({
            "ok": False,
            "servicio": "PermiGest LBSC API",
            "base_datos": "sin conexion"
        }), 500

@app.route("/api/solicitudes", methods=["GET"])
@jwt_required()
def listar_solicitudes():
    try:
        claims = get_jwt()

        rol = claims.get("rol")
        id_funcionario = claims.get("id_funcionario")

        conexion = conectar_bd()
        cursor = conexion.cursor()

        consulta = """
            SELECT
                s.id_solicitud,
                CONCAT(
                    f.nombres, ' ',
                    f.apellido_paterno, ' ',
                    COALESCE(f.apellido_materno, '')
                ) AS funcionario,
                tp.nombre AS tipo_permiso,
                es.nombre AS estado,
                TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                TO_CHAR(s.fecha_termino, 'YYYY-MM-DD') AS fecha_termino,
                s.modalidad
            FROM solicitudes s
            JOIN funcionarios f
                ON f.id_funcionario = s.id_funcionario
            JOIN tipos_permiso tp
                ON tp.id_tipo_permiso = s.id_tipo_permiso
            JOIN estados_solicitud es
                ON es.id_estado = s.id_estado
        """

        if rol == "Administrador":
            consulta += """
                ORDER BY s.id_solicitud;
            """

            cursor.execute(consulta)

        else:
            consulta += """
                WHERE s.id_funcionario = %s
                ORDER BY s.id_solicitud;
            """

            cursor.execute(
                consulta,
                (id_funcionario,)
            )

        solicitudes = cursor.fetchall()

        cursor.close()
        conexion.close()

        return jsonify({
            "ok": True,
            "cantidad": len(solicitudes),
            "solicitudes": solicitudes
        }), 200

    except Exception as error:
        print(error)

        return jsonify({
            "ok": False,
            "error": "No fue posible obtener las solicitudes."
        }), 500

@app.route("/api/solicitudes", methods=["POST"])
@jwt_required()
def crear_solicitud():
    conexion = None
    cursor = None

    try:
        datos = request.get_json()

        claims = get_jwt()
        id_funcionario = claims.get("id_funcionario")

        if not datos:
            return jsonify({
                "ok": False,
                "error": "No se recibieron datos."
            }), 400

        campos_obligatorios = [
            "id_tipo_permiso",
            "fecha_inicio",
            "fecha_termino",
            "modalidad"
        ]

        for campo in campos_obligatorios:
            if campo not in datos or datos[campo] in (None, ""):
                return jsonify({
                    "ok": False,
                    "error": f"El campo {campo} es obligatorio."
                }), 400

        if datos["fecha_termino"] < datos["fecha_inicio"]:
            return jsonify({
                "ok": False,
                "error": "La fecha de término no puede ser anterior a la fecha de inicio."
            }), 400

        conexion = conectar_bd()
        cursor = conexion.cursor()


        cursor.execute("""
            SELECT
                id_tipo_permiso,
                nombre,
                unidad_control,
                requiere_horario
            FROM tipos_permiso
            WHERE id_tipo_permiso = %s
              AND activo = TRUE;
        """, (
            datos["id_tipo_permiso"],
        ))

        tipo_permiso = cursor.fetchone()

        if not tipo_permiso:
            return jsonify({
                "ok": False,
                "error": "El tipo de permiso seleccionado no es válido."
            }), 400


        cursor.execute("""
            SELECT
                s.id_solicitud,
                s.fecha_inicio,
                s.fecha_termino,
                e.nombre AS estado
            FROM solicitudes s
            INNER JOIN estados_solicitud e
                ON e.id_estado = s.id_estado
            WHERE s.id_funcionario = %s
              AND s.id_tipo_permiso = %s
              AND e.nombre IN ('Pendiente', 'Aprobada')
              AND s.fecha_inicio <= %s
              AND s.fecha_termino >= %s
            LIMIT 1;
        """, (
            id_funcionario,
            datos["id_tipo_permiso"],
            datos["fecha_termino"],
            datos["fecha_inicio"]
        ))

        solicitud_existente = cursor.fetchone()

        if solicitud_existente:
            return jsonify({
                "ok": False,
                "error": (
                    "Ya existe una solicitud pendiente o aprobada "
                    "del mismo tipo para la fecha o período seleccionado."
                )
            }), 409


        cursor.execute("""
            SELECT id_estado
            FROM estados_solicitud
            WHERE nombre = %s;
        """, (
            "Pendiente",
        ))

        estado = cursor.fetchone()

        if not estado:
            return jsonify({
                "ok": False,
                "error": "No se encontró el estado Pendiente."
            }), 500


        cursor.execute("""
            INSERT INTO solicitudes (
                id_funcionario,
                id_tipo_permiso,
                id_estado,
                fecha_inicio,
                fecha_termino,
                modalidad,
                cantidad_dias,
                cantidad_horas,
                observacion,
                requiere_reemplazo
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            RETURNING id_solicitud;
        """, (
            id_funcionario,
            datos["id_tipo_permiso"],
            estado["id_estado"],
            datos["fecha_inicio"],
            datos["fecha_termino"],
            datos["modalidad"],
            datos.get("cantidad_dias"),
            datos.get("cantidad_horas"),
            datos.get("observacion"),
            datos.get("requiere_reemplazo", False)
        ))

        nueva_solicitud = cursor.fetchone()

        conexion.commit()

        return jsonify({
            "ok": True,
            "mensaje": "Solicitud creada correctamente",
            "id_solicitud": nueva_solicitud["id_solicitud"]
        }), 201

    except Exception as error:
        print("Error al crear solicitud:", error)

        if conexion:
            conexion.rollback()

        return jsonify({
            "ok": False,
            "error": "No fue posible crear la solicitud."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    try:
        datos = request.get_json()

        if not datos:
            return jsonify({
                "ok": False,
                "error": "No se recibieron datos."
            }), 400

        correo = datos.get("correo")
        password = datos.get("password")

        if not correo or not password:
            return jsonify({
                "ok": False,
                "error": "Correo y contraseña son obligatorios."
            }), 400

        conexion = conectar_bd()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.id_funcionario,
                u.password_hash,
                u.activo AS usuario_activo,
                f.activo AS funcionario_activo,
                f.nombres,
                f.apellido_paterno,
                f.correo_institucional,
                r.nombre AS rol
            FROM usuarios u
            JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE LOWER(f.correo_institucional) = LOWER(%s)
            LIMIT 1;
        """, (correo,))

        usuario = cursor.fetchone()

        if not usuario:
            cursor.close()
            conexion.close()

            return jsonify({
                "ok": False,
                "error": "Credenciales incorrectas."
            }), 401

        if not usuario["usuario_activo"] or not usuario["funcionario_activo"]:
            cursor.close()
            conexion.close()

            return jsonify({
                "ok": False,
                "error": "Usuario inactivo."
            }), 403

        if not check_password_hash(
            usuario["password_hash"],
            password
        ):
            cursor.close()
            conexion.close()

            return jsonify({
                "ok": False,
                "error": "Credenciales incorrectas."
            }), 401

        cursor.execute("""
            UPDATE usuarios
            SET ultimo_acceso = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
            WHERE id_usuario = %s;
        """, (usuario["id_usuario"],))

        conexion.commit()

        token = create_access_token(
            identity=str(usuario["id_usuario"]),
            additional_claims={
                "rol": usuario["rol"],
                "id_funcionario": usuario["id_funcionario"]
            }
        )

        cursor.close()
        conexion.close()

        return jsonify({
            "ok": True,
            "mensaje": "Inicio de sesión correcto",
            "access_token": token,
            "usuario": {
                "id_usuario": usuario["id_usuario"],
                "id_funcionario": usuario["id_funcionario"],
                "nombre": usuario["nombres"] + " " + usuario["apellido_paterno"],
                "correo": usuario["correo_institucional"],
                "rol": usuario["rol"]
            }
        }), 200

    except Exception as error:
        print(error)

        return jsonify({
            "ok": False,
            "error": "No fue posible iniciar sesión."
        }), 500

@app.route("/api/estadisticas/solicitudes-por-estado", methods=["GET"])
@jwt_required()
def solicitudes_por_estado():
    try:
        claims = get_jwt()

        if claims.get("rol") != "Administrador":
            return jsonify({
                "ok": False,
                "error": "Acceso denegado. Se requiere rol Administrador."
            }), 403

        conexion = conectar_bd()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                es.nombre AS estado,
                COUNT(*) AS cantidad
            FROM solicitudes s
            JOIN estados_solicitud es
                ON es.id_estado = s.id_estado
            GROUP BY es.nombre
            ORDER BY es.nombre;
        """)

        datos = cursor.fetchall()

        cursor.close()
        conexion.close()

        return jsonify({
            "ok": True,
            "indicador": "solicitudes_por_estado",
            "datos": datos
        }), 200

    except Exception as error:
        print(error)

        return jsonify({
            "ok": False,
            "error": "No fue posible generar las estadísticas."
        }), 500


@app.route("/api/tipos-permiso", methods=["GET"])
@jwt_required()
def listar_tipos_permiso():
    conexion = None
    cursor = None

    try:
        conexion = conectar_bd()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                id_tipo_permiso,
                nombre,
                descripcion,
                unidad_control,
                requiere_horario
            FROM tipos_permiso
            WHERE activo = TRUE
            ORDER BY nombre;
        """)

        registros = cursor.fetchall()

        tipos = []

        for registro in registros:
            tipos.append({
                "id_tipo_permiso":
                    registro["id_tipo_permiso"],

                "nombre":
                    registro["nombre"],

                "descripcion":
                    registro["descripcion"],

                "unidad_control":
                    registro["unidad_control"],

                "requiere_horario":
                    registro["requiere_horario"]
            })

        return jsonify({
            "ok": True,
            "tipos": tipos
        }), 200

    except Exception as error:

        print(error)

        return jsonify({
            "ok": False,
            "error":
                "No fue posible obtener los tipos de permiso."
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.errorhandler(429)
def limite_excedido(error):
    return jsonify({
        "ok": False,
        "error": "Demasiados intentos. Intente nuevamente más tarde."
    }), 429

@app.route(
    "/api/solicitudes/<int:id_solicitud>/estado",
    methods=["PATCH"]
)
@jwt_required()
def resolver_estado_solicitud(id_solicitud):

    conexion = None
    cursor = None

    try:



        id_usuario = int(get_jwt_identity())


        conexion = conectar_bd()

        cursor = conexion.cursor(
            row_factory=dict_row
        )



        cursor.execute(
            """
            SELECT
                u.id_usuario,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s
              AND u.activo = TRUE;
            """,
            (id_usuario,)
        )


        usuario = cursor.fetchone()


        if not usuario:

            return jsonify({
                "error":
                    "Usuario autenticado no encontrado."
            }), 401


        if usuario["rol"] != "Administrador":

            return jsonify({
                "error":
                    "No tiene permisos para realizar esta operación."
            }), 403


        datos = request.get_json(
            silent=True
        ) or {}


        estado_nuevo = str(
            datos.get("estado", "")
        ).strip()


        observacion = str(
            datos.get("observacion", "")
        ).strip()


        if estado_nuevo not in [
            "Aprobada",
            "Rechazada"
        ]:

            return jsonify({
                "error":
                    "El estado indicado no es válido."
            }), 400


        if (
            estado_nuevo == "Rechazada"
            and not observacion
        ):

            return jsonify({
                "error":
                    "Debe indicar el motivo del rechazo."
            }), 400



        cursor.execute(
            """
            SELECT id_estado
            FROM estados_solicitud
            WHERE nombre = %s;
            """,
            (estado_nuevo,)
        )


        estado_destino = cursor.fetchone()


        if not estado_destino:

            return jsonify({
                "error":
                    "El estado solicitado no existe."
            }), 400


        id_estado_nuevo = (
            estado_destino["id_estado"]
        )



        cursor.execute(
            """
            SELECT
                s.id_solicitud,
                s.id_funcionario,
                s.id_tipo_permiso,
                s.fecha_inicio,
                s.fecha_termino,
                s.modalidad,
                s.hora_inicio,
                s.hora_termino,
                s.cantidad_dias,
                s.cantidad_horas,
                es.nombre AS estado_actual
            FROM solicitudes s
            INNER JOIN estados_solicitud es
                ON es.id_estado = s.id_estado
            WHERE s.id_solicitud = %s
            FOR UPDATE;
            """,
            (id_solicitud,)
        )


        solicitud = cursor.fetchone()


        if not solicitud:

            return jsonify({
                "error":
                    "La solicitud no existe."
            }), 404


        if (
            solicitud["estado_actual"]
            != "Pendiente"
        ):

            return jsonify({
                "error":
                    "La solicitud ya fue resuelta anteriormente."
            }), 409



        cursor.execute(
            """
            UPDATE solicitudes
            SET
                id_estado = %s,
                fecha_actualizacion =
                    CURRENT_TIMESTAMP
            WHERE id_solicitud = %s;
            """,
            (
                id_estado_nuevo,
                id_solicitud
            )
        )



        cursor.execute(
            """
            INSERT INTO historial_solicitud
            (
                id_solicitud,
                id_estado,
                id_usuario_accion,
                fecha_cambio,
                observacion
            )
            VALUES
            (
                %s,
                %s,
                %s,
                CURRENT_TIMESTAMP,
                %s
            );
            """,
            (
                id_solicitud,
                id_estado_nuevo,
                id_usuario,
                observacion or None
            )
        )



        if estado_nuevo == "Aprobada":

            cursor.execute(
                """
                INSERT INTO permisos
                (
                    id_solicitud,
                    id_funcionario,
                    id_tipo_permiso,
                    fecha_inicio,
                    fecha_termino,
                    modalidad,
                    hora_inicio,
                    hora_termino,
                    cantidad_dias,
                    cantidad_horas,
                    origen,
                    fecha_registro
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'SOLICITUD',
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT
                    (id_solicitud)
                DO NOTHING;
                """,
                (
                    id_solicitud,
                    solicitud[
                        "id_funcionario"
                    ],
                    solicitud[
                        "id_tipo_permiso"
                    ],
                    solicitud[
                        "fecha_inicio"
                    ],
                    solicitud[
                        "fecha_termino"
                    ],
                    solicitud[
                        "modalidad"
                    ],
                    solicitud[
                        "hora_inicio"
                    ],
                    solicitud[
                        "hora_termino"
                    ],
                    solicitud[
                        "cantidad_dias"
                    ],
                    solicitud[
                        "cantidad_horas"
                    ]
                )
            )



        cursor.execute(
            """
            SELECT id_usuario
            FROM usuarios
            WHERE id_funcionario = %s
              AND activo = TRUE;
            """,
            (
                solicitud[
                    "id_funcionario"
                ],
            )
        )


        usuario_funcionario = (
            cursor.fetchone()
        )



        if usuario_funcionario:

            mensaje_notificacion = (
                "Su solicitud N°"
                + str(id_solicitud)
                + " fue "
                + estado_nuevo.lower()
                + "."
            )


            cursor.execute(
                """
                INSERT INTO notificaciones
                (
                    id_usuario,
                    id_solicitud,
                    tipo,
                    mensaje,
                    leida,
                    fecha_creacion
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    FALSE,
                    CURRENT_TIMESTAMP
                );
                """,
                (
                    usuario_funcionario[
                        "id_usuario"
                    ],
                    id_solicitud,
                    "SOLICITUD_RESUELTA",
                    mensaje_notificacion
                )
            )



        detalle_auditoria = (
            "Solicitud "
            + str(id_solicitud)
            + " resuelta como "
            + estado_nuevo
        )


        cursor.execute(
            """
            INSERT INTO auditoria
            (
                id_usuario,
                accion,
                entidad,
                id_registro,
                detalle,
                direccion_ip,
                fecha_evento
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                CURRENT_TIMESTAMP
            );
            """,
            (
                id_usuario,
                "RESOLVER_SOLICITUD",
                "solicitudes",
                id_solicitud,
                detalle_auditoria,
                request.remote_addr
            )
        )



        conexion.commit()


        return jsonify({
            "ok": True,
            "mensaje":
                "Solicitud "
                + estado_nuevo.lower()
                + " correctamente.",
            "id_solicitud":
                id_solicitud,
            "estado":
                estado_nuevo
        }), 200


    except Exception as error:

        if conexion:

            conexion.rollback()


        print(
            "Error al resolver solicitud:",
            error
        )


        return jsonify({
            "ok": False,
            "error":
                "No fue posible resolver la solicitud."
        }), 500


    finally:

        if cursor:

            cursor.close()


        if conexion:

            conexion.close()

@app.route("/api/admin/funcionarios", methods=["GET"])
@jwt_required()
def listar_funcionarios_admin():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)


        cursor.execute("""
            SELECT
                u.id_usuario,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s
              AND u.activo = TRUE;
        """, (id_usuario,))

        usuario_actual = cursor.fetchone()

        if not usuario_actual:
            return jsonify({
                "error": "Usuario no encontrado o inactivo."
            }), 401

        if usuario_actual["rol"] != "Administrador":
            return jsonify({
                "error": "No tiene permisos para acceder a esta información."
            }), 403


        cursor.execute("""
            SELECT
                f.id_funcionario,
                f.nombres,
                f.apellido_paterno,
                f.apellido_materno,
                f.correo_institucional,
                f.activo,
                un.id_unidad,
                un.nombre AS unidad,
                u.id_usuario,
                r.id_rol,
                r.nombre AS rol,
                u.activo AS usuario_activo
            FROM funcionarios f
            INNER JOIN unidades un
                ON un.id_unidad = f.id_unidad
            LEFT JOIN usuarios u
                ON u.id_funcionario = f.id_funcionario
            LEFT JOIN roles r
                ON r.id_rol = u.id_rol
            ORDER BY
                f.apellido_paterno,
                f.apellido_materno NULLS LAST,
                f.nombres;
        """)

        funcionarios = cursor.fetchall()

        return jsonify({
            "total": len(funcionarios),
            "funcionarios": funcionarios
        }), 200

    except Exception as error:
        print("Error al listar funcionarios:", error)

        return jsonify({
            "error": "No fue posible obtener los funcionarios."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route("/admin/funcionarios")
def funcionarios_admin_page():
    return render_template("funcionarios_admin.html")

@app.route("/api/admin/catalogos/funcionarios", methods=["GET"])
@jwt_required()
def catalogos_funcionarios_admin():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)


        cursor.execute("""
            SELECT r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s
              AND u.activo = TRUE;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if not usuario:
            return jsonify({
                "error": "Usuario no encontrado o inactivo."
            }), 401

        if usuario["rol"] != "Administrador":
            return jsonify({
                "error": "No tiene permisos para realizar esta operación."
            }), 403

        cursor.execute("""
            SELECT
                id_unidad,
                nombre
            FROM unidades
            WHERE activo = TRUE
            ORDER BY nombre;
        """)

        unidades = cursor.fetchall()


        cursor.execute("""
            SELECT
                id_rol,
                nombre
            FROM roles
            WHERE activo = TRUE
            ORDER BY nombre;
        """)

        roles = cursor.fetchall()

        return jsonify({
            "unidades": unidades,
            "roles": roles
        }), 200

    except Exception as error:
        print("Error al obtener catálogos:", error)

        return jsonify({
            "error": "No fue posible obtener los datos necesarios."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route("/api/admin/funcionarios", methods=["POST"])
@jwt_required()
def crear_funcionario_admin():
    conexion = None
    cursor = None

    try:
        id_usuario_admin = int(get_jwt_identity())

        datos = request.get_json(silent=True) or {}

        nombres = str(datos.get("nombres", "")).strip()
        apellido_paterno = str(datos.get("apellido_paterno", "")).strip()
        apellido_materno = str(datos.get("apellido_materno", "")).strip()
        correo = str(datos.get("correo_institucional", "")).strip().lower()
        password = str(datos.get("password", ""))

        id_unidad = datos.get("id_unidad")
        id_rol = datos.get("id_rol")



        if not nombres:
            return jsonify({
                "error": "El nombre es obligatorio."
            }), 400

        if not apellido_paterno:
            return jsonify({
                "error": "El apellido paterno es obligatorio."
            }), 400

        if not correo:
            return jsonify({
                "error": "El correo institucional es obligatorio."
            }), 400

        if "@" not in correo:
            return jsonify({
                "error": "El correo electrónico no es válido."
            }), 400

        if not id_unidad:
            return jsonify({
                "error": "Debe seleccionar una unidad."
            }), 400

        if not id_rol:
            return jsonify({
                "error": "Debe seleccionar un rol."
            }), 400

        if len(password) < 8:
            return jsonify({
                "error": "La contraseña debe contener al menos 8 caracteres."
            }), 400


        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)




        cursor.execute("""
            SELECT r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s
              AND u.activo = TRUE;
        """, (id_usuario_admin,))

        usuario_admin = cursor.fetchone()

        if not usuario_admin:
            return jsonify({
                "error": "Usuario no encontrado o inactivo."
            }), 401

        if usuario_admin["rol"] != "Administrador":
            return jsonify({
                "error": "No tiene permisos para crear funcionarios."
            }), 403




        cursor.execute("""
            SELECT id_unidad
            FROM unidades
            WHERE id_unidad = %s
              AND activo = TRUE;
        """, (id_unidad,))

        if not cursor.fetchone():
            return jsonify({
                "error": "La unidad seleccionada no es válida."
            }), 400




        cursor.execute("""
            SELECT id_rol
            FROM roles
            WHERE id_rol = %s
              AND activo = TRUE;
        """, (id_rol,))

        if not cursor.fetchone():
            return jsonify({
                "error": "El rol seleccionado no es válido."
            }), 400




        cursor.execute("""
            SELECT id_funcionario
            FROM funcionarios
            WHERE LOWER(correo_institucional) = LOWER(%s);
        """, (correo,))

        if cursor.fetchone():
            return jsonify({
                "error": "Ya existe un funcionario registrado con ese correo."
            }), 409




        cursor.execute("""
            INSERT INTO funcionarios (
                id_unidad,
                nombres,
                apellido_paterno,
                apellido_materno,
                correo_institucional,
                activo
            )
            VALUES (%s, %s, %s, %s, %s, TRUE)
            RETURNING id_funcionario;
        """, (
            id_unidad,
            nombres,
            apellido_paterno,
            apellido_materno if apellido_materno else None,
            correo
        ))

        nuevo_funcionario = cursor.fetchone()

        id_funcionario = nuevo_funcionario["id_funcionario"]




        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO usuarios (
                id_funcionario,
                id_rol,
                password_hash,
                activo
            )
            VALUES (%s, %s, %s, TRUE)
            RETURNING id_usuario;
        """, (
            id_funcionario,
            id_rol,
            password_hash
        ))

        nuevo_usuario = cursor.fetchone()




        cursor.execute("""
            INSERT INTO auditoria (
                id_usuario,
                accion,
                entidad,
                id_registro,
                detalle,
                direccion_ip
            )
            VALUES (%s, %s, %s, %s, %s, %s);
        """, (
            id_usuario_admin,
            "CREAR_FUNCIONARIO",
            "funcionarios",
            id_funcionario,
            "Creación de funcionario y cuenta de acceso.",
            request.remote_addr
        ))


        conexion.commit()


        return jsonify({
            "mensaje": "Funcionario creado correctamente.",
            "id_funcionario": id_funcionario,
            "id_usuario": nuevo_usuario["id_usuario"]
        }), 201


    except Exception as error:

        if conexion:
            conexion.rollback()

        print("Error al crear funcionario:", error)

        return jsonify({
            "error": "No fue posible crear el funcionario."
        }), 500


    finally:

        if cursor:
            cursor.close()

        if conexion:
            conexion.close()


@app.route("/api/admin/funcionarios/<int:id_funcionario>", methods=["PATCH"])
@jwt_required()
def editar_funcionario_admin(id_funcionario):
    conexion = None
    cursor = None

    try:
        id_usuario_admin = int(get_jwt_identity())
        datos = request.get_json(silent=True) or {}

        nombres = str(datos.get("nombres", "")).strip()
        apellido_paterno = str(
            datos.get("apellido_paterno", "")
        ).strip()

        apellido_materno = str(
            datos.get("apellido_materno", "")
        ).strip()

        correo = str(
            datos.get("correo_institucional", "")
        ).strip().lower()

        id_unidad = datos.get("id_unidad")
        id_rol = datos.get("id_rol")
        activo = datos.get("activo")

        nueva_password = str(
            datos.get("password", "")
        )



        if not nombres:
            return jsonify({
                "error": "El nombre es obligatorio."
            }), 400

        if not apellido_paterno:
            return jsonify({
                "error": "El apellido paterno es obligatorio."
            }), 400

        if not correo or "@" not in correo:
            return jsonify({
                "error": "El correo electrónico no es válido."
            }), 400

        if not id_unidad:
            return jsonify({
                "error": "Debe seleccionar una unidad."
            }), 400

        if not id_rol:
            return jsonify({
                "error": "Debe seleccionar un rol."
            }), 400

        if not isinstance(activo, bool):
            return jsonify({
                "error": "El estado del funcionario no es válido."
            }), 400

        if nueva_password and len(nueva_password) < 8:
            return jsonify({
                "error":
                    "La nueva contraseña debe contener al menos 8 caracteres."
            }), 400


        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)



        cursor.execute("""
            SELECT
                u.id_usuario,
                u.id_funcionario,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s
              AND u.activo = TRUE;
        """, (id_usuario_admin,))

        administrador = cursor.fetchone()

        if not administrador:
            return jsonify({
                "error": "Usuario no encontrado o inactivo."
            }), 401

        if administrador["rol"] != "Administrador":
            return jsonify({
                "error":
                    "No tiene permisos para editar funcionarios."
            }), 403




        cursor.execute("""
            SELECT
                f.id_funcionario,
                u.id_usuario,
                u.id_rol
            FROM funcionarios f
            LEFT JOIN usuarios u
                ON u.id_funcionario = f.id_funcionario
            WHERE f.id_funcionario = %s;
        """, (id_funcionario,))

        funcionario_actual = cursor.fetchone()

        if not funcionario_actual:
            return jsonify({
                "error": "El funcionario no existe."
            }), 404



        cursor.execute("""
            SELECT id_unidad
            FROM unidades
            WHERE id_unidad = %s
              AND activo = TRUE;
        """, (id_unidad,))

        if not cursor.fetchone():
            return jsonify({
                "error": "La unidad seleccionada no es válida."
            }), 400




        cursor.execute("""
            SELECT
                id_rol,
                nombre
            FROM roles
            WHERE id_rol = %s
              AND activo = TRUE;
        """, (id_rol,))

        rol_seleccionado = cursor.fetchone()

        if not rol_seleccionado:
            return jsonify({
                "error": "El rol seleccionado no es válido."
            }), 400



        cursor.execute("""
            SELECT id_funcionario
            FROM funcionarios
            WHERE LOWER(correo_institucional) = LOWER(%s)
              AND id_funcionario <> %s;
        """, (
            correo,
            id_funcionario
        ))

        if cursor.fetchone():
            return jsonify({
                "error":
                    "Ya existe otro funcionario con ese correo."
            }), 409




        if (
            funcionario_actual["id_usuario"] == id_usuario_admin
            and activo is False
        ):
            return jsonify({
                "error":
                    "No puede desactivar su propia cuenta mientras está autenticado."
            }), 400


        if (
            funcionario_actual["id_usuario"] == id_usuario_admin
            and rol_seleccionado["nombre"] != "Administrador"
        ):
            return jsonify({
                "error":
                    "No puede quitarse a sí mismo el rol Administrador."
            }), 400




        cursor.execute("""
            UPDATE funcionarios
            SET
                id_unidad = %s,
                nombres = %s,
                apellido_paterno = %s,
                apellido_materno = %s,
                correo_institucional = %s,
                activo = %s
            WHERE id_funcionario = %s;
        """, (
            id_unidad,
            nombres,
            apellido_paterno,
            apellido_materno if apellido_materno else None,
            correo,
            activo,
            id_funcionario
        ))



        cursor.execute("""
            UPDATE usuarios
            SET
                id_rol = %s,
                activo = %s,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_funcionario = %s;
        """, (
            id_rol,
            activo,
            id_funcionario
        ))



        if nueva_password:

            password_hash = generate_password_hash(
                nueva_password
            )

            cursor.execute("""
                UPDATE usuarios
                SET
                    password_hash = %s,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id_funcionario = %s;
            """, (
                password_hash,
                id_funcionario
            ))



        cursor.execute("""
            INSERT INTO auditoria (
                id_usuario,
                accion,
                entidad,
                id_registro,
                detalle,
                direccion_ip
            )
            VALUES (%s, %s, %s, %s, %s, %s);
        """, (
            id_usuario_admin,
            "EDITAR_FUNCIONARIO",
            "funcionarios",
            id_funcionario,
            "Actualización de datos del funcionario.",
            request.remote_addr
        ))


        conexion.commit()


        return jsonify({
            "mensaje": "Funcionario actualizado correctamente."
        }), 200


    except Exception as error:

        if conexion:
            conexion.rollback()

        print(
            "Error al editar funcionario:",
            error
        )

        return jsonify({
            "error":
                "No fue posible actualizar el funcionario."
        }), 500


    finally:

        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route("/api/historial", methods=["GET"])
@jwt_required()
def obtener_historial():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.id_funcionario,
                u.activo,
                f.activo AS funcionario_activo,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if (
            not usuario
            or not usuario["activo"]
            or not usuario["funcionario_activo"]
        ):
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        consulta_base = """
            SELECT
                s.id_solicitud,
                f.nombres,
                f.apellido_paterno,
                f.apellido_materno,
                tp.nombre AS tipo_permiso,
                e.nombre AS estado,
                TO_CHAR(s.fecha_solicitud, 'YYYY-MM-DD HH24:MI') AS fecha_solicitud,
                TO_CHAR(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                TO_CHAR(s.fecha_termino, 'YYYY-MM-DD') AS fecha_termino,
                s.modalidad,
                TO_CHAR(s.hora_inicio, 'HH24:MI') AS hora_inicio,
                TO_CHAR(s.hora_termino, 'HH24:MI') AS hora_termino,
                s.cantidad_dias,
                s.cantidad_horas,
                s.observacion AS observacion_solicitud,
                ult.observacion AS observacion_resolucion,
                TO_CHAR(ult.fecha_cambio, 'YYYY-MM-DD HH24:MI') AS fecha_resolucion
            FROM solicitudes s
            INNER JOIN funcionarios f
                ON f.id_funcionario = s.id_funcionario
            INNER JOIN tipos_permiso tp
                ON tp.id_tipo_permiso = s.id_tipo_permiso
            INNER JOIN estados_solicitud e
                ON e.id_estado = s.id_estado
            LEFT JOIN LATERAL (
                SELECT
                    hs.observacion,
                    hs.fecha_cambio
                FROM historial_solicitud hs
                WHERE hs.id_solicitud = s.id_solicitud
                ORDER BY
                    hs.fecha_cambio DESC,
                    hs.id_historial DESC
                LIMIT 1
            ) ult ON TRUE
        """

        if usuario["rol"] == "Administrador":
            consulta = consulta_base + """
                ORDER BY
                    s.fecha_solicitud DESC,
                    s.id_solicitud DESC;
            """

            cursor.execute(consulta)

        else:
            consulta = consulta_base + """
                WHERE s.id_funcionario = %s
                ORDER BY
                    s.fecha_solicitud DESC,
                    s.id_solicitud DESC;
            """

            cursor.execute(
                consulta,
                (usuario["id_funcionario"],)
            )

        historial = cursor.fetchall()

        return jsonify({
            "total": len(historial),
            "historial": historial
        }), 200

    except Exception as error:
        print("Error al obtener historial:", error)

        return jsonify({
            "error": "No fue posible obtener el historial."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()


@app.route("/historial")
def historial_page():
    return render_template("historial.html")


@app.route("/api/permisos", methods=["GET"])
@jwt_required()
def obtener_permisos():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.id_funcionario,
                u.activo,
                f.activo AS funcionario_activo,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if (
            not usuario
            or not usuario["activo"]
            or not usuario["funcionario_activo"]
        ):
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        consulta = """
            SELECT
                p.id_permiso,
                p.id_solicitud,
                f.id_funcionario,
                f.nombres,
                f.apellido_paterno,
                f.apellido_materno,
                tp.nombre AS tipo_permiso,
                TO_CHAR(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                TO_CHAR(p.fecha_termino, 'YYYY-MM-DD') AS fecha_termino,
                p.modalidad,
                TO_CHAR(p.hora_inicio, 'HH24:MI') AS hora_inicio,
                TO_CHAR(p.hora_termino, 'HH24:MI') AS hora_termino,
                COALESCE(p.cantidad_dias, 0)::float AS cantidad_dias,
                COALESCE(p.cantidad_horas, 0)::float AS cantidad_horas,
                p.origen,
                TO_CHAR(
                    p.fecha_registro,
                    'YYYY-MM-DD HH24:MI'
                ) AS fecha_registro
            FROM permisos p
            INNER JOIN funcionarios f
                ON f.id_funcionario = p.id_funcionario
            INNER JOIN tipos_permiso tp
                ON tp.id_tipo_permiso = p.id_tipo_permiso
        """

        if usuario["rol"] == "Administrador":

            consulta += """
                ORDER BY
                    p.fecha_inicio DESC,
                    p.id_permiso DESC;
            """

            cursor.execute(consulta)

        else:

            consulta += """
                WHERE p.id_funcionario = %s
                ORDER BY
                    p.fecha_inicio DESC,
                    p.id_permiso DESC;
            """

            cursor.execute(
                consulta,
                (usuario["id_funcionario"],)
            )

        permisos = cursor.fetchall()

        total_dias = sum(
            float(permiso["cantidad_dias"] or 0)
            for permiso in permisos
        )

        total_horas = sum(
            float(permiso["cantidad_horas"] or 0)
            for permiso in permisos
        )

        return jsonify({
            "total": len(permisos),
            "total_dias": total_dias,
            "total_horas": total_horas,
            "permisos": permisos
        }), 200

    except Exception as error:

        print(
            "Error al obtener permisos:",
            error
        )

        return jsonify({
            "error": "No fue posible obtener los permisos."
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexion:
            conexion.close()


@app.route("/permisos")
def permisos_page():
    return render_template("permisos.html")


@app.route("/estadisticas")
def estadisticas_page():
    return render_template("estadisticas.html")

@app.route("/api/estadisticas/resumen", methods=["GET"])
@jwt_required()
def obtener_estadisticas_resumen():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.activo,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if not usuario or not usuario["activo"]:
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        if usuario["rol"] != "Administrador":
            return jsonify({
                "error": "No tiene permisos para consultar estadísticas."
            }), 403

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM solicitudes;
        """)

        total_solicitudes = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT
                es.nombre AS estado,
                COUNT(*) AS cantidad
            FROM solicitudes s
            INNER JOIN estados_solicitud es
                ON es.id_estado = s.id_estado
            GROUP BY es.nombre
            ORDER BY es.nombre;
        """)

        solicitudes_por_estado = cursor.fetchall()

        cursor.execute("""
            SELECT
                tp.nombre AS tipo,
                COUNT(*) AS cantidad
            FROM solicitudes s
            INNER JOIN tipos_permiso tp
                ON tp.id_tipo_permiso = s.id_tipo_permiso
            GROUP BY tp.nombre
            ORDER BY cantidad DESC, tp.nombre;
        """)

        solicitudes_por_tipo = cursor.fetchall()

        cursor.execute("""
            SELECT
                CONCAT(
                    f.nombres,
                    ' ',
                    f.apellido_paterno,
                    CASE
                        WHEN f.apellido_materno IS NOT NULL
                        THEN ' ' || f.apellido_materno
                        ELSE ''
                    END
                ) AS funcionario,
                COUNT(*) AS cantidad
            FROM solicitudes s
            INNER JOIN funcionarios f
                ON f.id_funcionario = s.id_funcionario
            GROUP BY
                f.id_funcionario,
                f.nombres,
                f.apellido_paterno,
                f.apellido_materno
            ORDER BY cantidad DESC, funcionario;
        """)

        solicitudes_por_funcionario = cursor.fetchall()

        cursor.execute("""
            SELECT
                un.nombre AS unidad,
                COUNT(*) AS cantidad
            FROM solicitudes s
            INNER JOIN funcionarios f
                ON f.id_funcionario = s.id_funcionario
            INNER JOIN unidades un
                ON un.id_unidad = f.id_unidad
            GROUP BY un.nombre
            ORDER BY cantidad DESC, un.nombre;
        """)

        solicitudes_por_unidad = cursor.fetchall()

        cursor.execute("""
            SELECT
                TO_CHAR(
                    DATE_TRUNC('month', fecha_solicitud),
                    'YYYY-MM'
                ) AS periodo,
                COUNT(*) AS cantidad
            FROM solicitudes
            GROUP BY DATE_TRUNC('month', fecha_solicitud)
            ORDER BY DATE_TRUNC('month', fecha_solicitud);
        """)

        solicitudes_por_mes = cursor.fetchall()

        cursor.execute("""
            SELECT
                TO_CHAR(
                    fecha_inicio,
                    'YYYY-MM-DD'
                ) AS fecha,
                COUNT(*) AS cantidad
            FROM solicitudes
            GROUP BY fecha_inicio
            ORDER BY
                cantidad DESC,
                fecha_inicio DESC
            LIMIT 5;
        """)

        fechas_mayor_demanda = cursor.fetchall()

        cursor.execute("""
            SELECT
                COUNT(*) AS total_permisos,
                COALESCE(
                    SUM(cantidad_dias),
                    0
                )::float AS total_dias,
                COALESCE(
                    SUM(cantidad_horas),
                    0
                )::float AS total_horas
            FROM permisos;
        """)

        resumen_permisos = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM funcionarios
            WHERE activo = TRUE;
        """)

        funcionarios_activos = cursor.fetchone()["total"]

        return jsonify({
            "total_solicitudes": total_solicitudes,
            "funcionarios_activos": funcionarios_activos,
            "total_permisos": resumen_permisos["total_permisos"],
            "total_dias": resumen_permisos["total_dias"],
            "total_horas": resumen_permisos["total_horas"],
            "solicitudes_por_estado": solicitudes_por_estado,
            "solicitudes_por_tipo": solicitudes_por_tipo,
            "solicitudes_por_funcionario": solicitudes_por_funcionario,
            "solicitudes_por_unidad": solicitudes_por_unidad,
            "solicitudes_por_mes": solicitudes_por_mes,
            "fechas_mayor_demanda": fechas_mayor_demanda
        }), 200

    except Exception as error:
        print(
            "Error al obtener estadísticas:",
            error
        )

        return jsonify({
            "error": "No fue posible obtener las estadísticas."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route("/auditoria")
def auditoria_page():
    return render_template("auditoria.html")


@app.route("/api/auditoria", methods=["GET"])
@jwt_required()
def obtener_auditoria():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.activo,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if not usuario or not usuario["activo"]:
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        if usuario["rol"] != "Administrador":
            return jsonify({
                "error": "No tiene permisos para consultar la auditoría."
            }), 403

        cursor.execute("""
            SELECT
                a.id_auditoria,
                a.id_usuario,
                CONCAT(
                    f.nombres,
                    ' ',
                    f.apellido_paterno,
                    CASE
                        WHEN f.apellido_materno IS NOT NULL
                        THEN ' ' || f.apellido_materno
                        ELSE ''
                    END
                ) AS usuario,
                r.nombre AS rol,
                a.accion,
                a.entidad,
                a.id_registro,
                a.detalle,
                a.direccion_ip,
                TO_CHAR(
                    a.fecha_evento,
                    'YYYY-MM-DD HH24:MI:SS'
                ) AS fecha_evento
            FROM auditoria a
            INNER JOIN usuarios u
                ON u.id_usuario = a.id_usuario
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            ORDER BY
                a.fecha_evento DESC,
                a.id_auditoria DESC;
        """)

        registros = cursor.fetchall()

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM auditoria
            WHERE fecha_evento::date = CURRENT_DATE;
        """)

        registros_hoy = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(DISTINCT accion) AS total
            FROM auditoria;
        """)

        tipos_accion = cursor.fetchone()["total"]

        return jsonify({
            "total": len(registros),
            "registros_hoy": registros_hoy,
            "tipos_accion": tipos_accion,
            "auditoria": registros
        }), 200

    except Exception as error:
        print(
            "Error al obtener auditoría:",
            error
        )

        return jsonify({
            "error":
                "No fue posible obtener los registros de auditoría."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()


@app.route("/recuperar-contrasena")
def recuperar_contrasena_page():
    return render_template(
        "recuperar_contrasena.html"
    )


@app.route("/restablecer-contrasena")
def restablecer_contrasena_page():
    return render_template(
        "restablecer_contrasena.html"
    )

@app.route(
    "/api/auth/recuperar-password",
    methods=["POST"]
)
@limiter.limit("3 per 15 minutes")
def solicitar_recuperacion_password():
    conexion = None
    cursor = None

    mensaje_generico = (
        "Si el correo se encuentra registrado, "
        "recibirá instrucciones para recuperar su contraseña."
    )

    try:
        datos = request.get_json(
            silent=True
        ) or {}

        correo = str(
            datos.get("correo", "")
        ).strip().lower()

        if not correo or "@" not in correo:
            return jsonify({
                "error":
                    "Debe ingresar un correo electrónico válido."
            }), 400

        conexion = conectar_bd()
        cursor = conexion.cursor(
            row_factory=dict_row
        )

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.password_hash,
                u.activo AS usuario_activo,
                f.activo AS funcionario_activo,
                f.nombres,
                f.apellido_paterno,
                f.correo_institucional
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            WHERE LOWER(
                f.correo_institucional
            ) = LOWER(%s)
            LIMIT 1;
        """, (correo,))

        usuario = cursor.fetchone()

        cursor.close()
        cursor = None
        conexion.close()
        conexion = None

        if (
            usuario
            and usuario["usuario_activo"]
            and usuario["funcionario_activo"]
        ):
            try:
                if not usuario["password_hash"]:
                    raise RuntimeError(
                        "El usuario no posee una contraseña configurada."
                    )

                token = generar_token_recuperacion(
                    usuario["id_usuario"],
                    usuario["password_hash"]
                )

                enlace = (
                    app.config["APP_BASE_URL"]
                    + "/restablecer-contrasena?token="
                    + token
                )

                nombre = (
                    usuario["nombres"]
                    + " "
                    + usuario["apellido_paterno"]
                )

                enviar_correo_recuperacion(
                    usuario[
                        "correo_institucional"
                    ],
                    nombre,
                    enlace
                )

            except Exception as error_recuperacion:
                print(
                    "Error interno en recuperación de contraseña:",
                    type(error_recuperacion).__name__,
                    "-",
                    error_recuperacion
                )

        return jsonify({
            "mensaje": mensaje_generico
        }), 200

    except Exception as error:
        print(
            "Error al consultar recuperación de contraseña:",
            type(error).__name__,
            "-",
            error
        )

        return jsonify({
            "error":
                "No fue posible procesar la solicitud."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()


@app.route(
    "/api/auth/restablecer-password",
    methods=["POST"]
)
@limiter.limit("5 per 15 minutes")
def restablecer_password():
    conexion = None
    cursor = None

    try:
        datos = request.get_json(
            silent=True
        ) or {}

        token = str(
            datos.get("token", "")
        ).strip()

        nueva_password = str(
            datos.get("password", "")
        )

        if not token:
            return jsonify({
                "error":
                    "El enlace de recuperación no es válido."
            }), 400

        if len(nueva_password) < 8:
            return jsonify({
                "error":
                    "La contraseña debe contener al menos 8 caracteres."
            }), 400

        serializer = (
            obtener_serializer_recuperacion()
        )

        try:
            contenido = serializer.loads(
                token,
                max_age=app.config[
                    "PASSWORD_RESET_MAX_AGE"
                ]
            )

        except SignatureExpired:
            return jsonify({
                "error":
                    "El enlace de recuperación ha expirado."
            }), 400

        except BadSignature:
            return jsonify({
                "error":
                    "El enlace de recuperación no es válido."
            }), 400

        id_usuario = contenido.get(
            "id_usuario"
        )

        huella_token = contenido.get(
            "huella"
        )

        if not id_usuario or not huella_token:
            return jsonify({
                "error":
                    "El enlace de recuperación no es válido."
            }), 400

        conexion = conectar_bd()
        cursor = conexion.cursor(
            row_factory=dict_row
        )

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.password_hash,
                u.activo AS usuario_activo,
                f.activo AS funcionario_activo
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            WHERE u.id_usuario = %s
            FOR UPDATE;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if (
            not usuario
            or not usuario["usuario_activo"]
            or not usuario["funcionario_activo"]
            or not usuario["password_hash"]
        ):
            return jsonify({
                "error":
                    "El enlace de recuperación no es válido."
            }), 400

        huella_actual = generar_huella_password(
            usuario["password_hash"]
        )

        if not hmac.compare_digest(
            huella_actual,
            str(huella_token)
        ):
            return jsonify({
                "error":
                    "El enlace de recuperación ya no es válido."
            }), 400

        nuevo_hash = generate_password_hash(
            nueva_password
        )

        cursor.execute("""
            UPDATE usuarios
            SET
                password_hash = %s,
                fecha_actualizacion =
                    CURRENT_TIMESTAMP
            WHERE id_usuario = %s;
        """, (
            nuevo_hash,
            id_usuario
        ))

        cursor.execute("""
            INSERT INTO auditoria (
                id_usuario,
                accion,
                entidad,
                id_registro,
                detalle,
                direccion_ip
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            );
        """, (
            id_usuario,
            "RESTABLECER_PASSWORD",
            "usuarios",
            id_usuario,
            "Restablecimiento de contraseña mediante enlace seguro.",
            request.remote_addr
        ))

        conexion.commit()

        return jsonify({
            "mensaje":
                "Contraseña actualizada correctamente."
        }), 200

    except Exception as error:
        if conexion:
            conexion.rollback()

        print(
            "Error al restablecer contraseña:",
            type(error).__name__,
            "-",
            error
        )

        return jsonify({
            "error":
                "No fue posible restablecer la contraseña."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()


@app.route("/perfil")
def perfil_page():
    return render_template("perfil.html")

@app.route("/api/perfil", methods=["GET"])
@jwt_required()
def obtener_perfil():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.id_funcionario,
                f.nombres,
                f.apellido_paterno,
                f.apellido_materno,
                f.correo_institucional,
                un.nombre AS unidad,
                r.nombre AS rol,
                f.activo AS funcionario_activo,
                u.activo AS usuario_activo,
                TO_CHAR(
                    (
                        u.ultimo_acceso AT TIME ZONE 'UTC'
                    ) AT TIME ZONE 'America/Santiago',
                    'DD/MM/YYYY HH24:MI'
                ) AS ultimo_acceso
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            INNER JOIN unidades un
                ON un.id_unidad = f.id_unidad
            INNER JOIN roles r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        perfil = cursor.fetchone()

        if (
            not perfil
            or not perfil["usuario_activo"]
            or not perfil["funcionario_activo"]
        ):
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        return jsonify({
            "perfil": perfil
        }), 200

    except Exception as error:
        print(
            "Error al obtener perfil:",
            error
        )

        return jsonify({
            "error":
                "No fue posible obtener la información de la cuenta."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route("/api/perfil", methods=["PATCH"])
@jwt_required()
def actualizar_perfil():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        datos = request.get_json(
            silent=True
        ) or {}

        nombres = str(
            datos.get("nombres", "")
        ).strip()

        apellido_paterno = str(
            datos.get("apellido_paterno", "")
        ).strip()

        apellido_materno = str(
            datos.get("apellido_materno", "")
        ).strip()

        if not nombres:
            return jsonify({
                "error":
                    "El nombre es obligatorio."
            }), 400

        if not apellido_paterno:
            return jsonify({
                "error":
                    "El apellido paterno es obligatorio."
            }), 400

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_funcionario,
                u.activo AS usuario_activo,
                f.activo AS funcionario_activo
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if (
            not usuario
            or not usuario["usuario_activo"]
            or not usuario["funcionario_activo"]
        ):
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        cursor.execute("""
            UPDATE funcionarios
            SET
                nombres = %s,
                apellido_paterno = %s,
                apellido_materno = %s
            WHERE id_funcionario = %s;
        """, (
            nombres,
            apellido_paterno,
            apellido_materno
                if apellido_materno
                else None,
            usuario["id_funcionario"]
        ))

        cursor.execute("""
            INSERT INTO auditoria (
                id_usuario,
                accion,
                entidad,
                id_registro,
                detalle,
                direccion_ip
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            );
        """, (
            id_usuario,
            "ACTUALIZAR_PERFIL",
            "funcionarios",
            usuario["id_funcionario"],
            "Actualización de datos personales de la cuenta.",
            request.remote_addr
        ))

        conexion.commit()

        return jsonify({
            "mensaje":
                "Datos personales actualizados correctamente."
        }), 200

    except Exception as error:
        if conexion:
            conexion.rollback()

        print(
            "Error al actualizar perfil:",
            error
        )

        return jsonify({
            "error":
                "No fue posible actualizar los datos personales."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()

@app.route(
    "/api/perfil/cambiar-password",
    methods=["PATCH"]
)
@jwt_required()
@limiter.limit("5 per 15 minutes")
def cambiar_password_perfil():
    conexion = None
    cursor = None

    try:
        id_usuario = int(get_jwt_identity())

        datos = request.get_json(
            silent=True
        ) or {}

        password_actual = str(
            datos.get("password_actual", "")
        )

        nueva_password = str(
            datos.get("nueva_password", "")
        )

        if not password_actual:
            return jsonify({
                "error":
                    "Debe ingresar su contraseña actual."
            }), 400

        if len(nueva_password) < 8:
            return jsonify({
                "error":
                    "La nueva contraseña debe contener al menos 8 caracteres."
            }), 400

        conexion = conectar_bd()
        cursor = conexion.cursor(row_factory=dict_row)

        cursor.execute("""
            SELECT
                u.id_usuario,
                u.password_hash,
                u.activo AS usuario_activo,
                f.activo AS funcionario_activo
            FROM usuarios u
            INNER JOIN funcionarios f
                ON f.id_funcionario = u.id_funcionario
            WHERE u.id_usuario = %s;
        """, (id_usuario,))

        usuario = cursor.fetchone()

        if (
            not usuario
            or not usuario["usuario_activo"]
            or not usuario["funcionario_activo"]
        ):
            return jsonify({
                "error": "Usuario no autorizado."
            }), 401

        if not check_password_hash(
            usuario["password_hash"],
            password_actual
        ):
            return jsonify({
                "error":
                    "La contraseña actual es incorrecta."
            }), 400

        if check_password_hash(
            usuario["password_hash"],
            nueva_password
        ):
            return jsonify({
                "error":
                    "La nueva contraseña debe ser diferente de la actual."
            }), 400

        nuevo_hash = generate_password_hash(
            nueva_password
        )

        cursor.execute("""
            UPDATE usuarios
            SET
                password_hash = %s,
                fecha_actualizacion =
                    CURRENT_TIMESTAMP
            WHERE id_usuario = %s;
        """, (
            nuevo_hash,
            id_usuario
        ))

        cursor.execute("""
            INSERT INTO auditoria (
                id_usuario,
                accion,
                entidad,
                id_registro,
                detalle,
                direccion_ip
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            );
        """, (
            id_usuario,
            "CAMBIAR_PASSWORD",
            "usuarios",
            id_usuario,
            "Cambio de contraseña realizado desde Mi cuenta.",
            request.remote_addr
        ))

        conexion.commit()

        return jsonify({
            "mensaje":
                "Contraseña actualizada correctamente."
        }), 200

    except Exception as error:
        if conexion:
            conexion.rollback()

        print(
            "Error al cambiar contraseña:",
            error
        )

        return jsonify({
            "error":
                "No fue posible cambiar la contraseña."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if conexion:
            conexion.close()



if __name__ == "__main__":
    faltantes_recuperacion = (
        validar_configuracion_recuperacion()
    )

    if faltantes_recuperacion:
        print(
            "AVISO: faltan variables para recuperación:",
            ", ".join(faltantes_recuperacion)
        )
    else:
        print(
            "Configuración de recuperación: OK"
        )

    app.run(debug=True)