const token =
    sessionStorage.getItem("access_token");

const usuarioGuardado =
    sessionStorage.getItem("usuario");


if (!token || !usuarioGuardado) {

    sessionStorage.clear();
    window.location.href = "/";

    throw new Error("Sesión no disponible.");
}


let usuario;

try {

    usuario =
        JSON.parse(usuarioGuardado);

} catch (error) {

    sessionStorage.clear();
    window.location.href = "/";

    throw new Error(
        "Datos de usuario inválidos."
    );
}


if (usuario.rol !== "Administrador") {

    window.location.href =
        "/dashboard";

    throw new Error(
        "Acceso exclusivo para Administradores."
    );
}



const nombreUsuario =
    document.getElementById(
        "nombre-usuario"
    );

const rolUsuario =
    document.getElementById(
        "rol-usuario"
    );

const listaSolicitudes =
    document.getElementById(
        "lista-solicitudes"
    );

const totalSolicitudes =
    document.getElementById(
        "total-solicitudes"
    );

const totalPendientes =
    document.getElementById(
        "total-pendientes"
    );

const totalAprobadas =
    document.getElementById(
        "total-aprobadas"
    );

const totalRechazadas =
    document.getElementById(
        "total-rechazadas"
    );


const modal =
    document.getElementById(
        "modal-resolucion"
    );

const modalTitulo =
    document.getElementById(
        "modal-titulo"
    );

const modalDescripcion =
    document.getElementById(
        "modal-descripcion"
    );

const observacionResolucion =
    document.getElementById(
        "observacion-resolucion"
    );

const mensajeResolucion =
    document.getElementById(
        "mensaje-resolucion"
    );

const btnCancelar =
    document.getElementById(
        "btn-cancelar-resolucion"
    );

const btnConfirmar =
    document.getElementById(
        "btn-confirmar-resolucion"
    );




nombreUsuario.textContent =
    usuario.nombre || "Administrador";

rolUsuario.textContent =
    usuario.rol;




let solicitudSeleccionada = null;
let estadoSeleccionado = null;




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



async function cargarSolicitudes() {

    listaSolicitudes.innerHTML =
        "<p>Cargando solicitudes...</p>";


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

            window.location.href =
                "/dashboard";

            return;
        }


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.error ||
                "No fue posible cargar las solicitudes."
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


        actualizarIndicadores(
            solicitudes
        );


        mostrarPendientes(
            solicitudes
        );


    } catch (error) {

        console.error(error);

        listaSolicitudes.innerHTML =
            "<p>No fue posible cargar las solicitudes.</p>";
    }
}



function actualizarIndicadores(
    solicitudes
) {

    let pendientes = 0;
    let aprobadas = 0;
    let rechazadas = 0;


    solicitudes.forEach(
        function (solicitud) {

            const estado =
                String(
                    solicitud.estado || ""
                )
                .trim()
                .toLowerCase();


            if (estado === "pendiente") {
                pendientes++;
            }

            if (estado === "aprobada") {
                aprobadas++;
            }

            if (estado === "rechazada") {
                rechazadas++;
            }
        }
    );


    totalSolicitudes.textContent =
        solicitudes.length;

    totalPendientes.textContent =
        pendientes;

    totalAprobadas.textContent =
        aprobadas;

    totalRechazadas.textContent =
        rechazadas;
}


function mostrarPendientes(
    solicitudes
) {

    const pendientes =
        solicitudes.filter(
            function (solicitud) {

                return (
                    String(
                        solicitud.estado || ""
                    )
                    .trim()
                    .toLowerCase()
                    === "pendiente"
                );
            }
        );


    listaSolicitudes.innerHTML = "";


    if (pendientes.length === 0) {

        listaSolicitudes.innerHTML = `
            <p>
                No existen solicitudes pendientes.
            </p>
        `;

        return;
    }


    pendientes.forEach(
        function (solicitud) {

            const tarjeta =
                document.createElement("article");


            tarjeta.className =
                "solicitud-admin-card";


            tarjeta.innerHTML = `

                <div class="solicitud-admin-info">

                    <div>

                        <span class="info-label">
                            Solicitud #${escaparHTML(
                                solicitud.id_solicitud
                            )}
                        </span>

                        <h3>
                            ${escaparHTML(
                                solicitud.funcionario
                            )}
                        </h3>

                    </div>


                    <span
                        class="status-badge estado-pendiente"
                    >
                        Pendiente
                    </span>

                </div>


                <div class="solicitud-admin-detalle">

                    <div>
                        <strong>
                            Tipo
                        </strong>

                        <span>
                            ${escaparHTML(
                                solicitud.tipo_permiso
                            )}
                        </span>
                    </div>


                    <div>
                        <strong>
                            Fecha inicio
                        </strong>

                        <span>
                            ${escaparHTML(
                                solicitud.fecha_inicio
                            )}
                        </span>
                    </div>


                    <div>
                        <strong>
                            Fecha término
                        </strong>

                        <span>
                            ${escaparHTML(
                                solicitud.fecha_termino ||
                                solicitud.fecha_inicio
                            )}
                        </span>
                    </div>


                    <div>
                        <strong>
                            Modalidad
                        </strong>

                        <span>
                            ${escaparHTML(
                                solicitud.modalidad
                            )}
                        </span>
                    </div>

                </div>


                <div class="solicitud-admin-actions">

                    <button
                        type="button"
                        class="btn-rechazar"
                    >
                        Rechazar
                    </button>

                    <button
                        type="button"
                        class="btn-aprobar"
                    >
                        Aprobar
                    </button>

                </div>
            `;


            const btnAprobar =
                tarjeta.querySelector(
                    ".btn-aprobar"
                );


            const btnRechazar =
                tarjeta.querySelector(
                    ".btn-rechazar"
                );


            btnAprobar.addEventListener(
                "click",
                function () {

                    abrirModal(
                        solicitud,
                        "Aprobada"
                    );
                }
            );


            btnRechazar.addEventListener(
                "click",
                function () {

                    abrirModal(
                        solicitud,
                        "Rechazada"
                    );
                }
            );


            listaSolicitudes.appendChild(
                tarjeta
            );
        }
    );
}




function abrirModal(
    solicitud,
    estado
) {

    solicitudSeleccionada =
        solicitud;

    estadoSeleccionado =
        estado;


    observacionResolucion.value =
        "";

    mensajeResolucion.textContent =
        "";


    if (estado === "Aprobada") {

        modalTitulo.textContent =
            "Aprobar solicitud";

        modalDescripcion.textContent =
            "Confirme la aprobación de la solicitud #" +
            solicitud.id_solicitud + ".";

        btnConfirmar.textContent =
            "Aprobar solicitud";

    } else {

        modalTitulo.textContent =
            "Rechazar solicitud";

        modalDescripcion.textContent =
            "Indique el motivo del rechazo de la solicitud #" +
            solicitud.id_solicitud + ".";

        btnConfirmar.textContent =
            "Rechazar solicitud";
    }


    modal.style.display =
        "flex";
}


function cerrarModal() {

    modal.style.display =
        "none";

    solicitudSeleccionada =
        null;

    estadoSeleccionado =
        null;

    observacionResolucion.value =
        "";

    mensajeResolucion.textContent =
        "";
}


btnCancelar.addEventListener(
    "click",
    cerrarModal
);




btnConfirmar.addEventListener(
    "click",
    async function () {

        if (
            !solicitudSeleccionada ||
            !estadoSeleccionado
        ) {

            return;
        }


        if (
            estadoSeleccionado ===
            "Rechazada" &&
            !observacionResolucion.value.trim()
        ) {

            mensajeResolucion.textContent =
                "Debe indicar el motivo del rechazo.";

            mensajeResolucion.className =
                "mensaje-solicitud mensaje-error";

            return;
        }


        btnConfirmar.disabled =
            true;

        btnConfirmar.textContent =
            "Procesando...";


        try {

            const respuesta =
                await fetch(
                    "/api/solicitudes/" +
                    solicitudSeleccionada.id_solicitud +
                    "/estado",
                    {
                        method: "PATCH",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " + token
                        },

                        body:
                            JSON.stringify({

                                estado:
                                    estadoSeleccionado,

                                observacion:
                                    observacionResolucion
                                        .value
                                        .trim()
                            })
                    }
                );


            const datos =
                await respuesta.json();


            if (!respuesta.ok) {

                mensajeResolucion.textContent =
                    datos.error ||
                    datos.mensaje ||
                    "No fue posible resolver la solicitud.";

                mensajeResolucion.className =
                    "mensaje-solicitud mensaje-error";

                return;
            }


            cerrarModal();

            await cargarSolicitudes();


        } catch (error) {

            console.error(error);

            mensajeResolucion.textContent =
                "No fue posible conectar con el servidor.";

            mensajeResolucion.className =
                "mensaje-solicitud mensaje-error";


        } finally {

            btnConfirmar.disabled =
                false;
        }
    }
);

cargarSolicitudes();