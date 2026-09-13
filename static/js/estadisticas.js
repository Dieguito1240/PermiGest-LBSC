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

    const totalSolicitudes =
        document.getElementById("total-solicitudes");

    const totalPermisos =
        document.getElementById("total-permisos");

    const funcionariosActivos =
        document.getElementById("funcionarios-activos");

    const totalDias =
        document.getElementById("total-dias");

    const totalHoras =
        document.getElementById("total-horas");

    const graficoEstados =
        document.getElementById("grafico-estados");

    const graficoTipos =
        document.getElementById("grafico-tipos");

    const graficoFuncionarios =
        document.getElementById("grafico-funcionarios");

    const graficoUnidades =
        document.getElementById("grafico-unidades");

    const graficoMeses =
        document.getElementById("grafico-meses");

    const tablaDemanda =
        document.getElementById("tabla-demanda");

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


    async function cargarEstadisticas() {

        try {

            const respuesta = await fetch(
                "/api/estadisticas/resumen",
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
                    "No fue posible obtener las estadísticas."
                );
            }

            totalSolicitudes.textContent =
                datos.total_solicitudes || 0;

            totalPermisos.textContent =
                datos.total_permisos || 0;

            funcionariosActivos.textContent =
                datos.funcionarios_activos || 0;

            totalDias.textContent =
                formatearNumero(
                    datos.total_dias || 0
                );

            totalHoras.textContent =
                formatearNumero(
                    datos.total_horas || 0
                );

            crearGrafico(
                graficoEstados,
                datos.solicitudes_por_estado,
                "estado"
            );

            crearGrafico(
                graficoTipos,
                datos.solicitudes_por_tipo,
                "tipo"
            );

            crearGrafico(
                graficoFuncionarios,
                datos.solicitudes_por_funcionario,
                "funcionario"
            );

            crearGrafico(
                graficoUnidades,
                datos.solicitudes_por_unidad,
                "unidad"
            );

            crearGrafico(
                graficoMeses,
                datos.solicitudes_por_mes,
                "periodo",
                true
            );

            mostrarFechasDemanda(
                datos.fechas_mayor_demanda || []
            );

        } catch (error) {

            console.error(
                "Error al cargar estadísticas:",
                error
            );

            mostrarError(
                "No fue posible cargar la información estadística."
            );
        }
    }


    function crearGrafico(
        contenedor,
        datos,
        campoEtiqueta,
        esPeriodo = false
    ) {

        contenedor.innerHTML = "";

        if (!datos || datos.length === 0) {

            contenedor.innerHTML = `
                <p class="sin-datos">
                    No existen datos disponibles.
                </p>
            `;

            return;
        }

        const maximo =
            Math.max(
                ...datos.map(
                    item =>
                        Number(item.cantidad || 0)
                )
            );

        datos.forEach(function (item) {

            const cantidad =
                Number(item.cantidad || 0);

            const porcentaje =
                maximo > 0
                    ? (
                        cantidad /
                        maximo
                    ) * 100
                    : 0;

            let etiqueta =
                item[campoEtiqueta] || "-";

            if (esPeriodo) {
                etiqueta =
                    formatearPeriodo(etiqueta);
            }

            const fila =
                document.createElement("div");

            fila.className =
                "barra-item";

            fila.innerHTML = `
                <div class="barra-header">
                    <span>
                        ${escaparHTML(etiqueta)}
                    </span>

                    <strong>
                        ${cantidad}
                    </strong>
                </div>

                <div class="barra-fondo">

                    <div
                        class="barra-progreso"
                        style="width: ${porcentaje}%"
                    >
                    </div>

                </div>
            `;

            contenedor.appendChild(
                fila
            );
        });
    }


    function mostrarFechasDemanda(datos) {

        tablaDemanda.innerHTML = "";

        if (datos.length === 0) {

            tablaDemanda.innerHTML = `
                <tr>
                    <td colspan="2">
                        No existen datos disponibles.
                    </td>
                </tr>
            `;

            return;
        }

        datos.forEach(function (item) {

            const fila =
                document.createElement("tr");

            fila.innerHTML = `
                <td>
                    ${escaparHTML(
                        formatearFecha(item.fecha)
                    )}
                </td>

                <td>
                    ${item.cantidad}
                </td>
            `;

            tablaDemanda.appendChild(
                fila
            );
        });
    }


    function formatearFecha(valor) {

        if (!valor) {
            return "-";
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


    function formatearPeriodo(valor) {

        if (!valor) {
            return "-";
        }

        const partes =
            String(valor).split("-");

        if (partes.length !== 2) {
            return valor;
        }

        const meses = [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre"
        ];

        const indice =
            Number(partes[1]) - 1;

        if (
            indice < 0 ||
            indice > 11
        ) {
            return valor;
        }

        return (
            meses[indice] +
            " " +
            partes[0]
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


    function mostrarError(mensaje) {

        const paneles =
            document.querySelectorAll(
                ".grafico-barras"
            );

        paneles.forEach(function (panel) {

            panel.innerHTML = `
                <p class="sin-datos">
                    ${escaparHTML(mensaje)}
                </p>
            `;
        });

        tablaDemanda.innerHTML = `
            <tr>
                <td colspan="2">
                    ${escaparHTML(mensaje)}
                </td>
            </tr>
        `;
    }


    btnLogout.addEventListener(
        "click",
        function () {

            sessionStorage.clear();

            window.location.href = "/";
        }
    );


    cargarEstadisticas();

});