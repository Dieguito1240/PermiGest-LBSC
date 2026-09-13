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

    const totalRegistros =
        document.getElementById("total-registros");

    const registrosHoy =
        document.getElementById("registros-hoy");

    const tiposAccion =
        document.getElementById("tipos-accion");

    const tablaAuditoria =
        document.getElementById("tabla-auditoria");

    const buscarAuditoria =
        document.getElementById("buscar-auditoria");

    const filtroAccion =
        document.getElementById("filtro-accion");

    let registrosAuditoria = [];

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

    if (usuario.rol !== "Administrador") {
        window.location.href = "/dashboard";
        return;
    }

    nombreUsuario.textContent =
        usuario.nombre || "Administrador";

    rolUsuario.textContent =
        usuario.rol || "Administrador";


    async function cargarAuditoria() {

        try {

            const respuesta = await fetch(
                "/api/auditoria",
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

            if (respuesta.status === 403) {
                window.location.href = "/dashboard";
                return;
            }

            const datos =
                await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error ||
                    "No fue posible cargar la auditoría."
                );
            }

            registrosAuditoria =
                datos.auditoria || [];

            totalRegistros.textContent =
                datos.total || 0;

            registrosHoy.textContent =
                datos.registros_hoy || 0;

            tiposAccion.textContent =
                datos.tipos_accion || 0;

            cargarFiltroAcciones(
                registrosAuditoria
            );

            mostrarAuditoria(
                registrosAuditoria
            );

        } catch (error) {

            console.error(
                "Error al cargar auditoría:",
                error
            );

            tablaAuditoria.innerHTML = `
                <tr>
                    <td colspan="8">
                        No fue posible cargar los registros de auditoría.
                    </td>
                </tr>
            `;
        }
    }


    function cargarFiltroAcciones(registros) {

        const acciones = [
            ...new Set(
                registros
                    .map(
                        registro =>
                            registro.accion
                    )
                    .filter(Boolean)
            )
        ].sort();

        filtroAccion.innerHTML = `
            <option value="">
                Todas las acciones
            </option>
        `;

        acciones.forEach(
            function (accion) {

                const opcion =
                    document.createElement("option");

                opcion.value =
                    accion;

                opcion.textContent =
                    formatearAccion(accion);

                filtroAccion.appendChild(
                    opcion
                );
            }
        );
    }


    function mostrarAuditoria(registros) {

        tablaAuditoria.innerHTML = "";

        if (registros.length === 0) {

            tablaAuditoria.innerHTML = `
                <tr>
                    <td colspan="8">
                        No existen registros de auditoría.
                    </td>
                </tr>
            `;

            return;
        }

        registros.forEach(
            function (registro) {

                const fila =
                    document.createElement("tr");

                fila.innerHTML = `
                    <td>
                        ${registro.id_auditoria}
                    </td>

                    <td>
                        ${escaparHTML(
                            formatearFechaHora(
                                registro.fecha_evento
                            )
                        )}
                    </td>

                    <td>
                        ${escaparHTML(
                            registro.usuario || "-"
                        )}
                    </td>

                    <td>
                        <strong>
                            ${escaparHTML(
                                formatearAccion(
                                    registro.accion
                                )
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escaparHTML(
                            formatearEntidad(
                                registro.entidad
                            )
                        )}
                    </td>

                    <td>
                        ${
                            registro.id_registro
                                ?? "-"
                        }
                    </td>

                    <td>
                        ${escaparHTML(
                            registro.detalle || "-"
                        )}
                    </td>

                    <td>
                        ${escaparHTML(
                            registro.direccion_ip || "-"
                        )}
                    </td>
                `;

                tablaAuditoria.appendChild(
                    fila
                );
            }
        );
    }


    function aplicarFiltros() {

        const texto =
            buscarAuditoria.value
                .trim()
                .toLowerCase();

        const accion =
            filtroAccion.value;

        const filtrados =
            registrosAuditoria.filter(
                function (registro) {

                    const coincideAccion =
                        !accion ||
                        registro.accion === accion;

                    const contenido =
                        [
                            registro.usuario,
                            registro.accion,
                            registro.entidad,
                            registro.detalle,
                            registro.id_registro,
                            registro.direccion_ip
                        ]
                            .filter(
                                valor =>
                                    valor != null
                            )
                            .join(" ")
                            .toLowerCase();

                    const coincideTexto =
                        !texto ||
                        contenido.includes(texto);

                    return (
                        coincideAccion &&
                        coincideTexto
                    );
                }
            );

        mostrarAuditoria(filtrados);
    }


    function formatearAccion(valor) {

        if (!valor) {
            return "-";
        }

        return String(valor)
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(
                /\b\w/g,
                letra =>
                    letra.toUpperCase()
            );
    }


    function formatearEntidad(valor) {

        if (!valor) {
            return "-";
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


    function formatearFechaHora(valor) {

        if (!valor) {
            return "-";
        }

        const partes =
            String(valor)
                .split(" ");

        const fecha =
            partes[0];

        const hora =
            partes[1] || "";

        const componentes =
            fecha.split("-");

        if (
            componentes.length !== 3
        ) {
            return valor;
        }

        return (
            componentes[2] +
            "/" +
            componentes[1] +
            "/" +
            componentes[0] +
            (
                hora
                    ? " " + hora
                    : ""
            )
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


    buscarAuditoria.addEventListener(
        "input",
        aplicarFiltros
    );


    filtroAccion.addEventListener(
        "change",
        aplicarFiltros
    );


    btnLogout.addEventListener(
        "click",
        function () {

            sessionStorage.clear();

            window.location.href = "/";
        }
    );


    cargarAuditoria();

});