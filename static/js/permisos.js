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

    const totalPermisos =
        document.getElementById("total-permisos");

    const totalDias =
        document.getElementById("total-dias");

    const totalHoras =
        document.getElementById("total-horas");

    const tablaPermisos =
        document.getElementById("tabla-permisos");

    const descripcionPermisos =
        document.getElementById("descripcion-permisos");

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

    async function cargarPermisos() {

        try {

            const respuesta = await fetch(
                "/api/permisos",
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
                    "No fue posible obtener los permisos."
                );
            }

            const permisos =
                datos.permisos || [];

            totalPermisos.textContent =
                datos.total || 0;

            totalDias.textContent =
                formatearNumero(
                    datos.total_dias || 0
                );

            totalHoras.textContent =
                formatearNumero(
                    datos.total_horas || 0
                );

            mostrarPermisos(permisos);

        } catch (error) {

            console.error(
                "Error al cargar permisos:",
                error
            );

            tablaPermisos.innerHTML = `
                <tr>
                    <td colspan="7">
                        No fue posible cargar los permisos.
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

        if (
            usuario.rol ===
            "Administrador"
        ) {

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

            descripcionPermisos.textContent =
                "Permisos aprobados de los funcionarios registrados en PermiGest LBSC.";

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
                        elemento.style.display =
                            "none";
                    }
                );

            descripcionPermisos.textContent =
                "Permisos aprobados asociados a su cuenta.";
        }
    }


    function mostrarPermisos(permisos) {

        tablaPermisos.innerHTML = "";

        if (permisos.length === 0) {

            tablaPermisos.innerHTML = `
                <tr>
                    <td colspan="7">
                        No existen permisos aprobados registrados.
                    </td>
                </tr>
            `;

            return;
        }

        permisos.forEach(
            function (permiso) {

                const fila =
                    document.createElement("tr");

                const nombreCompleto =
                    construirNombre(
                        permiso
                    );

                const periodo =
                    construirPeriodo(
                        permiso
                    );

                const modalidad =
                    formatearModalidad(
                        permiso.modalidad
                    );

                const cantidad =
                    construirCantidad(
                        permiso
                    );

                const solicitud =
                    permiso.id_solicitud
                        ? "#" +
                          permiso.id_solicitud
                        : "Histórico";

                fila.innerHTML = `
                    <td>
                        ${permiso.id_permiso}
                    </td>

                    <td class="col-funcionario">
                        ${escaparHTML(nombreCompleto)}
                    </td>

                    <td>
                        ${escaparHTML(
                            permiso.tipo_permiso || ""
                        )}
                    </td>

                    <td>
                        ${escaparHTML(periodo)}
                    </td>

                    <td>
                        ${escaparHTML(modalidad)}
                    </td>

                    <td>
                        ${escaparHTML(cantidad)}
                    </td>

                    <td>
                        ${escaparHTML(solicitud)}
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
                        .style.display =
                            "none";
                }

                tablaPermisos.appendChild(
                    fila
                );
            }
        );
    }


    function construirNombre(permiso) {

        let nombre =
            (
                permiso.nombres || ""
            ) +
            " " +
            (
                permiso.apellido_paterno || ""
            );

        if (permiso.apellido_materno) {

            nombre +=
                " " +
                permiso.apellido_materno;
        }

        return nombre.trim();
    }


    function construirPeriodo(permiso) {

        const inicio =
            formatearFecha(
                permiso.fecha_inicio
            );

        const termino =
            formatearFecha(
                permiso.fecha_termino
            );

        if (
            inicio &&
            termino &&
            inicio !== termino
        ) {

            return (
                inicio +
                " al " +
                termino
            );
        }

        return (
            inicio ||
            termino ||
            "-"
        );
    }


    function construirCantidad(permiso) {

        const dias =
            Number(
                permiso.cantidad_dias || 0
            );

        const horas =
            Number(
                permiso.cantidad_horas || 0
            );

        if (horas > 0) {

            return (
                formatearNumero(horas) +
                (
                    horas === 1
                        ? " hora"
                        : " horas"
                )
            );
        }

        if (dias > 0) {

            return (
                formatearNumero(dias) +
                (
                    dias === 1
                        ? " día"
                        : " días"
                )
            );
        }

        if (
            permiso.modalidad === "HORAS" &&
            permiso.hora_inicio &&
            permiso.hora_termino
        ) {

            return (
                permiso.hora_inicio +
                " - " +
                permiso.hora_termino
            );
        }

        return "-";
    }


    function formatearFecha(valor) {

        if (!valor) {
            return "";
        }

        const partes =
            String(valor)
                .substring(0, 10)
                .split("-");

        if (partes.length !== 3) {
            return String(valor);
        }

        return (
            partes[2] +
            "/" +
            partes[1] +
            "/" +
            partes[0]
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
                letra =>
                    letra.toUpperCase()
            );
    }


    function formatearNumero(valor) {

        const numero =
            Number(valor);

        if (Number.isNaN(numero)) {
            return "0";
        }

        return numero.toLocaleString(
            "es-CL",
            {
                maximumFractionDigits: 2
            }
        );
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


    cargarPermisos();

});