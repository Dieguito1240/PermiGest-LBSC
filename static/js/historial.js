document.addEventListener("DOMContentLoaded", function () {

    const token =
        sessionStorage.getItem("access_token");

    const usuarioGuardado =
        sessionStorage.getItem("usuario");

    const nombreUsuario =
        document.getElementById("nombre-usuario");

    const rolUsuario =
        document.getElementById("rol-usuario");

    const btnLogout =
        document.getElementById("btn-logout");

    const tablaHistorial =
        document.getElementById("tabla-historial");

    const totalRegistros =
        document.getElementById("total-registros");

    const totalAprobadas =
        document.getElementById("total-aprobadas");

    const totalPendientes =
        document.getElementById("total-pendientes");

    const totalRechazadas =
        document.getElementById("total-rechazadas");

    const descripcionHistorial =
        document.getElementById("descripcion-historial");

    if (!token || !usuarioGuardado) {
        window.location.href = "/";
        return;
    }

    let usuario;

    try {
        usuario = JSON.parse(usuarioGuardado);
    } catch (error) {
        sessionStorage.clear();
        window.location.href = "/";
        return;
    }

    nombreUsuario.textContent =
        usuario.nombre || "Usuario";

    rolUsuario.textContent =
        usuario.rol || "";

    configurarMenuPorRol();

    async function cargarHistorial() {

        try {

            const respuesta = await fetch(
                "/api/historial",
                {
                    method: "GET",
                    headers: {
                        "Authorization":
                            "Bearer " + token
                    }
                }
            );

            if (respuesta.status === 401) {
                sessionStorage.clear();
                window.location.href = "/";
                return;
            }

            const datos =
                await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error ||
                    "No fue posible obtener el historial."
                );
            }

            const historial =
                datos.historial || [];

            actualizarIndicadores(historial);
            mostrarHistorial(historial);

        } catch (error) {

            console.error(
                "Error al cargar historial:",
                error
            );

            tablaHistorial.innerHTML = `
                <tr>
                    <td colspan="7">
                        No fue posible cargar el historial.
                    </td>
                </tr>
            `;
        }
    }

    function configurarMenuPorRol() {

        const opcionesAdmin =
            document.querySelectorAll(
                ".admin-option"
            );

        const opcionesFuncionario =
            document.querySelectorAll(
                ".funcionario-option"
            );

        if (usuario.rol === "Administrador") {

            opcionesAdmin.forEach(
                elemento => {
                    elemento.style.display = "";
                }
            );

            opcionesFuncionario.forEach(
                elemento => {
                    elemento.style.display = "none";
                }
            );

            descripcionHistorial.textContent =
                "Historial general de solicitudes registradas en PermiGest LBSC.";

        } else {

            opcionesAdmin.forEach(
                elemento => {
                    elemento.style.display = "none";
                }
            );

            opcionesFuncionario.forEach(
                elemento => {
                    elemento.style.display = "";
                }
            );

            document
                .querySelectorAll(
                    ".col-funcionario"
                )
                .forEach(
                    elemento => {
                        elemento.style.display = "none";
                    }
                );

            descripcionHistorial.textContent =
                "Historial de solicitudes asociadas a su cuenta.";
        }
    }

    function actualizarIndicadores(historial) {

        const aprobadas =
            historial.filter(
                item =>
                    item.estado === "Aprobada"
            ).length;

        const pendientes =
            historial.filter(
                item =>
                    item.estado === "Pendiente"
            ).length;

        const rechazadas =
            historial.filter(
                item =>
                    item.estado === "Rechazada"
            ).length;

        totalRegistros.textContent =
            historial.length;

        totalAprobadas.textContent =
            aprobadas;

        totalPendientes.textContent =
            pendientes;

        totalRechazadas.textContent =
            rechazadas;
    }

    function mostrarHistorial(historial) {

        tablaHistorial.innerHTML = "";

        if (historial.length === 0) {

            tablaHistorial.innerHTML = `
                <tr>
                    <td colspan="7">
                        No existen registros en el historial.
                    </td>
                </tr>
            `;

            return;
        }

        historial.forEach(
            function (registro) {

                const fila =
                    document.createElement("tr");

                const nombreCompleto =
                    construirNombre(registro);

                const periodo =
                    construirPeriodo(registro);

                const modalidad =
                    formatearModalidad(
                        registro.modalidad
                    );

                const estadoClase =
                    obtenerClaseEstado(
                        registro.estado
                    );

                const resolucion =
                    obtenerResolucion(
                        registro
                    );

                fila.innerHTML = `
                    <td>
                        ${registro.id_solicitud}
                    </td>

                    <td class="col-funcionario">
                        ${escaparHTML(nombreCompleto)}
                    </td>

                    <td>
                        ${escaparHTML(
                            registro.tipo_permiso || ""
                        )}
                    </td>

                    <td>
                        ${escaparHTML(periodo)}
                    </td>

                    <td>
                        ${escaparHTML(modalidad)}
                    </td>

                    <td>
                        <span class="${estadoClase}">
                            ${escaparHTML(
                                registro.estado || ""
                            )}
                        </span>
                    </td>

                    <td>
                        ${escaparHTML(resolucion)}
                    </td>
                `;

                if (
                    usuario.rol !==
                    "Administrador"
                ) {
                    fila
                        .querySelector(
                            ".col-funcionario"
                        )
                        .style.display = "none";
                }

                tablaHistorial.appendChild(
                    fila
                );
            }
        );
    }

    function construirNombre(registro) {

        let nombre =
            (
                registro.nombres || ""
            ) +
            " " +
            (
                registro.apellido_paterno || ""
            );

        if (registro.apellido_materno) {
            nombre +=
                " " +
                registro.apellido_materno;
        }

        return nombre.trim();
    }

    function construirPeriodo(registro) {

        const inicio =
            formatearFecha(
                registro.fecha_inicio
            );

        const termino =
            formatearFecha(
                registro.fecha_termino
            );

        if (
            inicio &&
            termino &&
            inicio !== termino
        ) {
            return inicio + " al " + termino;
        }

        return inicio || termino || "-";
    }

    function formatearFecha(valor) {

        if (!valor) {
            return "";
        }

        if (
            typeof valor === "string" &&
            valor.length >= 10 &&
            valor.charAt(4) === "-" &&
            valor.charAt(7) === "-"
        ) {

            const partes =
                valor.substring(0, 10)
                    .split("-");

            return (
                partes[2] +
                "/" +
                partes[1] +
                "/" +
                partes[0]
            );
        }

        const fecha =
            new Date(valor);

        if (
            Number.isNaN(
                fecha.getTime()
            )
        ) {
            return String(valor);
        }

        return fecha.toLocaleDateString(
            "es-CL"
        );
    }

    function formatearModalidad(valor) {

        if (!valor) {
            return "-";
        }

        if (valor === "DIA_COMPLETO") {
            return "Día completo";
        }

        if (valor === "HORAS") {
            return "Por horas";
        }

        return String(valor)
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(
                /^./,
                letra => letra.toUpperCase()
            );
    }

    function obtenerResolucion(registro) {

        if (
            registro.estado ===
            "Pendiente"
        ) {
            return "Pendiente de resolución";
        }

        if (
            registro.observacion_resolucion
        ) {
            return registro.observacion_resolucion;
        }

        if (
            registro.estado ===
            "Aprobada"
        ) {
            return "Solicitud aprobada";
        }

        if (
            registro.estado ===
            "Rechazada"
        ) {
            return "Solicitud rechazada";
        }

        return "-";
    }

    function obtenerClaseEstado(estado) {

        if (estado === "Aprobada") {
            return "estado-aprobada";
        }

        if (estado === "Rechazada") {
            return "estado-rechazada";
        }

        return "estado-pendiente";
    }

    function escaparHTML(valor) {

        const elemento =
            document.createElement("div");

        elemento.textContent =
            valor == null
                ? ""
                : String(valor);

        return elemento.innerHTML;
    }

    btnLogout.addEventListener(
        "click",
        function () {

            sessionStorage.clear();

            window.location.href = "/";
        }
    );

    cargarHistorial();

});