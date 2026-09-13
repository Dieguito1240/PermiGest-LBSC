
const token = sessionStorage.getItem("access_token");
const usuarioGuardado = sessionStorage.getItem("usuario");

if (!token || !usuarioGuardado) {
    sessionStorage.clear();
    window.location.href = "/";
    throw new Error("Sesión no disponible.");
}




let usuario;

try {
    usuario = JSON.parse(usuarioGuardado);
} catch (error) {
    sessionStorage.clear();
    window.location.href = "/";
    throw new Error("Datos de usuario inválidos.");
}




const nombreUsuario =
    document.getElementById("nombre-usuario");

const rolUsuario =
    document.getElementById("rol-usuario");

const btnLogout =
    document.getElementById("btn-logout");

const tablaSolicitudes =
    document.getElementById("tabla-solicitudes");

const totalSolicitudes =
    document.getElementById("total-solicitudes");

const totalAprobadas =
    document.getElementById("total-aprobadas");

const totalPendientes =
    document.getElementById("total-pendientes");

const totalRechazadas =
    document.getElementById("total-rechazadas");




if (nombreUsuario) {
    nombreUsuario.textContent =
        usuario.nombre || "Usuario";
}

if (rolUsuario) {
    rolUsuario.textContent =
        usuario.rol || "Perfil";
}




function configurarMenuPorRol() {

    const opcionesAdmin =
        document.querySelectorAll(".admin-option");

    const opcionesFuncionario =
        document.querySelectorAll(".funcionario-option");


    if (usuario.rol === "Administrador") {

        opcionesAdmin.forEach(function (elemento) {
            elemento.style.display = "";
        });

        opcionesFuncionario.forEach(function (elemento) {
            elemento.style.display = "none";
        });

        return;
    }


    if (usuario.rol === "Funcionario") {

        opcionesAdmin.forEach(function (elemento) {
            elemento.style.display = "none";
        });

        opcionesFuncionario.forEach(function (elemento) {
            elemento.style.display = "";
        });

        return;
    }


    opcionesAdmin.forEach(function (elemento) {
        elemento.style.display = "none";
    });

    opcionesFuncionario.forEach(function (elemento) {
        elemento.style.display = "none";
    });
}


configurarMenuPorRol();



if (btnLogout) {

    btnLogout.addEventListener(
        "click",
        function () {

            sessionStorage.clear();
            window.location.href = "/";
        }
    );
}



function escaparHTML(valor) {

    const elemento =
        document.createElement("div");

    elemento.textContent =
        valor === null ||
        valor === undefined
            ? ""
            : String(valor);

    return elemento.innerHTML;
}



function normalizarEstado(estado) {

    return String(estado || "")
        .trim()
        .toLowerCase();
}



function formatearModalidad(modalidad) {

    if (!modalidad) {
        return "-";
    }

    const valor =
        String(modalidad)
            .trim()
            .toLowerCase()
            .replaceAll("_", " ");


    if (
        valor === "dia completo" ||
        valor === "día completo"
    ) {
        return "Día completo";
    }


    if (
        valor === "horas" ||
        valor === "por horas"
    ) {
        return "Por horas";
    }


    return String(modalidad)
        .replaceAll("_", " ");
}



function formatearFecha(fecha) {

    if (!fecha) {
        return "-";
    }

    const texto =
        String(fecha).substring(0, 10);

    const partes =
        texto.split("-");

    if (partes.length !== 3) {
        return texto;
    }

    return texto;
}




function obtenerClaseEstado(estado) {

    const valor =
        normalizarEstado(estado);


    if (valor === "aprobada") {
        return "estado-aprobada";
    }

    if (valor === "pendiente") {
        return "estado-pendiente";
    }

    if (valor === "rechazada") {
        return "estado-rechazada";
    }

    return "";
}




function obtenerId(solicitud) {

    return (
        solicitud.id_solicitud ??
        solicitud.id ??
        "-"
    );
}


function obtenerFuncionario(solicitud) {

    return (
        solicitud.funcionario ||
        solicitud.nombre_funcionario ||
        solicitud.funcionario_nombre ||
        solicitud.nombre ||
        "-"
    );
}


function obtenerTipo(solicitud) {

    return (
        solicitud.tipo_permiso ||
        solicitud.nombre_tipo_permiso ||
        solicitud.tipo ||
        "-"
    );
}


function obtenerFecha(solicitud) {

    return (
        solicitud.fecha_inicio ||
        solicitud.fecha ||
        "-"
    );
}


function obtenerModalidad(solicitud) {

    return (
        solicitud.modalidad ||
        "-"
    );
}


function obtenerEstado(solicitud) {

    return (
        solicitud.estado ||
        solicitud.nombre_estado ||
        "-"
    );
}




function actualizarIndicadores(solicitudes) {

    let aprobadas = 0;
    let pendientes = 0;
    let rechazadas = 0;


    solicitudes.forEach(function (solicitud) {

        const estado =
            normalizarEstado(
                obtenerEstado(solicitud)
            );


        if (estado === "aprobada") {
            aprobadas++;
        }

        if (estado === "pendiente") {
            pendientes++;
        }

        if (estado === "rechazada") {
            rechazadas++;
        }
    });


    if (totalSolicitudes) {
        totalSolicitudes.textContent =
            solicitudes.length;
    }

    if (totalAprobadas) {
        totalAprobadas.textContent =
            aprobadas;
    }

    if (totalPendientes) {
        totalPendientes.textContent =
            pendientes;
    }

    if (totalRechazadas) {
        totalRechazadas.textContent =
            rechazadas;
    }
}




function mostrarSolicitudes(solicitudes) {

    if (!tablaSolicitudes) {
        return;
    }


    tablaSolicitudes.innerHTML = "";


    if (
        !Array.isArray(solicitudes) ||
        solicitudes.length === 0
    ) {

        tablaSolicitudes.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    style="text-align: center;"
                >
                    No existen solicitudes disponibles.
                </td>
            </tr>
        `;

        return;
    }


    solicitudes.forEach(function (solicitud) {

        const fila =
            document.createElement("tr");

        const estado =
            obtenerEstado(solicitud);

        const claseEstado =
            obtenerClaseEstado(estado);


        fila.innerHTML = `
            <td>
                ${escaparHTML(
                    obtenerId(solicitud)
                )}
            </td>

            <td>
                ${escaparHTML(
                    obtenerFuncionario(solicitud)
                )}
            </td>

            <td>
                ${escaparHTML(
                    obtenerTipo(solicitud)
                )}
            </td>

            <td>
                ${escaparHTML(
                    formatearFecha(
                        obtenerFecha(solicitud)
                    )
                )}
            </td>

            <td>
                ${escaparHTML(
                    formatearModalidad(
                        obtenerModalidad(solicitud)
                    )
                )}
            </td>

            <td>
                <span
                    class="status-badge ${claseEstado}"
                >
                    ${escaparHTML(estado)}
                </span>
            </td>
        `;


        tablaSolicitudes.appendChild(fila);
    });
}



function mostrarCargando() {

    if (!tablaSolicitudes) {
        return;
    }

    tablaSolicitudes.innerHTML = `
        <tr>
            <td
                colspan="6"
                style="text-align: center;"
            >
                Cargando información...
            </td>
        </tr>
    `;
}




function mostrarErrorTabla(texto) {

    if (!tablaSolicitudes) {
        return;
    }

    tablaSolicitudes.innerHTML = `
        <tr>
            <td
                colspan="6"
                style="
                    text-align: center;
                    color: #b42318;
                "
            >
                ${escaparHTML(texto)}
            </td>
        </tr>
    `;
}



async function cargarSolicitudes(
    mostrarCarga = false
) {

    if (mostrarCarga) {
        mostrarCargando();
    }


    try {

        const respuesta =
            await fetch(
                "/api/solicitudes",
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            "Bearer " + token,

                        "Accept":
                            "application/json"
                    }
                }
            );


        if (
            respuesta.status === 401 ||
            respuesta.status === 422
        ) {

            sessionStorage.clear();
            window.location.href = "/";
            return;
        }


        if (respuesta.status === 403) {

            mostrarErrorTabla(
                "No tiene permisos para consultar esta información."
            );

            return;
        }


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.error ||
                datos.mensaje ||
                "No fue posible obtener las solicitudes."
            );
        }


        let solicitudes = [];


        if (Array.isArray(datos)) {

            solicitudes = datos;

        } else if (
            datos &&
            Array.isArray(datos.solicitudes)
        ) {

            solicitudes =
                datos.solicitudes;
        }


        mostrarSolicitudes(solicitudes);

        actualizarIndicadores(solicitudes);


    } catch (error) {

        console.error(
            "Error al cargar solicitudes:",
            error
        );

        mostrarErrorTabla(
            "No fue posible cargar las solicitudes."
        );
    }
}



cargarSolicitudes(true);



const intervaloActualizacion =
    setInterval(
        function () {

            cargarSolicitudes(false);

        },
        30000
    );




window.addEventListener(
    "beforeunload",
    function () {

        clearInterval(
            intervaloActualizacion
        );
    }
);