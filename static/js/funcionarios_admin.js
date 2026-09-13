document.addEventListener("DOMContentLoaded", function () {

    const token = sessionStorage.getItem("access_token");
    const usuarioGuardado = sessionStorage.getItem("usuario");

    const nombreUsuario = document.getElementById("nombreUsuario");
    const rolUsuario = document.getElementById("rolUsuario");

    const totalFuncionarios = document.getElementById("totalFuncionarios");
    const totalActivos = document.getElementById("totalActivos");
    const totalInactivos = document.getElementById("totalInactivos");

    const tablaFuncionarios = document.getElementById("tablaFuncionarios");

    const btnCerrarSesion = document.getElementById("btnCerrarSesion");
    const btnNuevoFuncionario = document.getElementById("btnNuevoFuncionario");

    const modalFuncionario = document.getElementById("modalFuncionario");
    const btnCerrarModal = document.getElementById("btnCerrarModal");
    const btnCancelarFuncionario = document.getElementById("btnCancelarFuncionario");

    const formNuevoFuncionario = document.getElementById("formNuevoFuncionario");
    const btnGuardarFuncionario = document.getElementById("btnGuardarFuncionario");
    const mensajeFuncionario = document.getElementById("mensajeFuncionario");

    const tituloModalFuncionario = document.getElementById("tituloModalFuncionario");
    const descripcionModalFuncionario = document.getElementById("descripcionModalFuncionario");

    const grupoEstadoFuncionario = document.getElementById("grupoEstadoFuncionario");
    const estadoFuncionario = document.getElementById("estadoFuncionario");

    const nombres = document.getElementById("nombres");
    const apellidoPaterno = document.getElementById("apellidoPaterno");
    const apellidoMaterno = document.getElementById("apellidoMaterno");
    const correoInstitucional = document.getElementById("correoInstitucional");

    const unidadFuncionario = document.getElementById("unidadFuncionario");
    const rolFuncionario = document.getElementById("rolFuncionario");

    const passwordFuncionario = document.getElementById("passwordFuncionario");
    const confirmarPassword = document.getElementById("confirmarPassword");

    const labelPasswordFuncionario = document.getElementById("labelPasswordFuncionario");
    const labelConfirmarPassword = document.getElementById("labelConfirmarPassword");

    let funcionariosActuales = [];
    let idFuncionarioEdicion = null;

    if (!token || !usuarioGuardado) {
        window.location.href = "/";
        return;
    }

    let usuario;

    try {
        usuario = JSON.parse(usuarioGuardado);
    } catch (error) {
        console.error("Error al leer usuario:", error);
        sessionStorage.clear();
        window.location.href = "/";
        return;
    }

    if (usuario.rol !== "Administrador") {
        alert("No tienes permisos para acceder a esta sección.");
        window.location.href = "/dashboard";
        return;
    }

    nombreUsuario.textContent = usuario.nombre || "Administrador";
    rolUsuario.textContent = usuario.rol || "Administrador";

    async function cargarFuncionarios() {

        tablaFuncionarios.innerHTML = `
            <tr>
                <td colspan="6">
                    Cargando funcionarios...
                </td>
            </tr>
        `;

        try {

            const respuesta = await fetch("/api/admin/funcionarios", {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            });

            if (respuesta.status === 401) {
                sessionStorage.clear();
                window.location.href = "/";
                return;
            }

            if (respuesta.status === 403) {
                alert("No tienes permisos para consultar funcionarios.");
                window.location.href = "/dashboard";
                return;
            }

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error ||
                    "No fue posible obtener los funcionarios."
                );
            }

            funcionariosActuales = datos.funcionarios || [];

            actualizarIndicadores(funcionariosActuales);
            mostrarFuncionarios(funcionariosActuales);

        } catch (error) {

            console.error(
                "Error al cargar funcionarios:",
                error
            );

            tablaFuncionarios.innerHTML = `
                <tr>
                    <td colspan="6">
                        No fue posible cargar los funcionarios.
                    </td>
                </tr>
            `;
        }
    }

    function actualizarIndicadores(funcionarios) {

        const activos = funcionarios.filter(
            funcionario => funcionario.activo === true
        ).length;

        totalFuncionarios.textContent = funcionarios.length;
        totalActivos.textContent = activos;
        totalInactivos.textContent = funcionarios.length - activos;
    }

    function mostrarFuncionarios(funcionarios) {

        tablaFuncionarios.innerHTML = "";

        if (funcionarios.length === 0) {

            tablaFuncionarios.innerHTML = `
                <tr>
                    <td colspan="6">
                        No existen funcionarios registrados.
                    </td>
                </tr>
            `;

            return;
        }

        funcionarios.forEach(function (funcionario) {

            const fila = document.createElement("tr");

            let nombreCompleto =
                funcionario.nombres +
                " " +
                funcionario.apellido_paterno;

            if (funcionario.apellido_materno) {
                nombreCompleto +=
                    " " +
                    funcionario.apellido_materno;
            }

            const estado =
                funcionario.activo
                    ? "Activo"
                    : "Inactivo";

            const claseEstado =
                funcionario.activo
                    ? "estado-aprobada"
                    : "estado-rechazada";

            fila.innerHTML = `
                <td>
                    <strong>
                        ${escaparHTML(nombreCompleto)}
                    </strong>
                </td>

                <td>
                    ${escaparHTML(
                        funcionario.correo_institucional || ""
                    )}
                </td>

                <td>
                    ${escaparHTML(
                        funcionario.unidad || "Sin unidad"
                    )}
                </td>

                <td>
                    ${escaparHTML(
                        funcionario.rol || "Sin cuenta"
                    )}
                </td>

                <td>
                    <span class="${claseEstado}">
                        ${estado}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="btn-secondary btn-editar"
                        data-id="${funcionario.id_funcionario}"
                    >
                        Editar
                    </button>
                </td>
            `;

            tablaFuncionarios.appendChild(fila);
        });

        document
            .querySelectorAll(".btn-editar")
            .forEach(function (boton) {

                boton.addEventListener(
                    "click",
                    function () {

                        abrirModalEditar(
                            this.dataset.id
                        );
                    }
                );
            });
    }

    async function cargarCatalogos() {

        try {

            const respuesta = await fetch(
                "/api/admin/catalogos/funcionarios",
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            if (respuesta.status === 401) {
                sessionStorage.clear();
                window.location.href = "/";
                return false;
            }

            if (respuesta.status === 403) {
                mostrarMensaje(
                    "No tienes permisos para obtener unidades y roles.",
                    "error"
                );

                return false;
            }

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error ||
                    "No fue posible cargar los datos necesarios."
                );
            }

            unidadFuncionario.innerHTML = `
                <option value="">
                    Seleccione una unidad
                </option>
            `;

            datos.unidades.forEach(function (unidad) {

                const opcion =
                    document.createElement("option");

                opcion.value =
                    unidad.id_unidad;

                opcion.textContent =
                    unidad.nombre;

                unidadFuncionario.appendChild(
                    opcion
                );
            });

            rolFuncionario.innerHTML = `
                <option value="">
                    Seleccione un rol
                </option>
            `;

            datos.roles.forEach(function (rol) {

                const opcion =
                    document.createElement("option");

                opcion.value =
                    rol.id_rol;

                opcion.textContent =
                    rol.nombre;

                rolFuncionario.appendChild(
                    opcion
                );
            });

            return true;

        } catch (error) {

            console.error(
                "Error al cargar catálogos:",
                error
            );

            mostrarMensaje(
                error.message,
                "error"
            );

            return false;
        }
    }

async function abrirModalCrear() {

    idFuncionarioEdicion = null;

    formNuevoFuncionario.reset();
    limpiarMensaje();

    tituloModalFuncionario.textContent =
        "Nuevo funcionario";

    descripcionModalFuncionario.textContent =
        "Registre al funcionario y cree su cuenta de acceso.";

    btnGuardarFuncionario.textContent =
        "Crear funcionario";

    grupoEstadoFuncionario.classList.add(
        "oculto"
    );

    passwordFuncionario.required = true;
    confirmarPassword.required = true;

    labelPasswordFuncionario.textContent =
        "Contraseña inicial *";

    labelConfirmarPassword.textContent =
        "Confirmar contraseña *";

    modalFuncionario.classList.remove(
        "oculto"
    );

    const catalogosCargados =
        await cargarCatalogos();

    if (!catalogosCargados) {
        return;
    }

    nombres.focus();
}

async function abrirModalEditar(idFuncionario) {

    const funcionario =
        funcionariosActuales.find(
            item =>
                Number(item.id_funcionario) ===
                Number(idFuncionario)
        );

    if (!funcionario) {

        alert(
            "No fue posible encontrar los datos del funcionario."
        );

        return;
    }

    idFuncionarioEdicion =
        funcionario.id_funcionario;

    formNuevoFuncionario.reset();
    limpiarMensaje();

    tituloModalFuncionario.textContent =
        "Editar funcionario";

    descripcionModalFuncionario.textContent =
        "Modifique los datos del funcionario y su cuenta de acceso.";

    btnGuardarFuncionario.textContent =
        "Guardar cambios";

    passwordFuncionario.required = false;
    confirmarPassword.required = false;

    passwordFuncionario.value = "";
    confirmarPassword.value = "";

    labelPasswordFuncionario.textContent =
        "Nueva contraseña (opcional)";

    labelConfirmarPassword.textContent =
        "Confirmar nueva contraseña";

    grupoEstadoFuncionario.classList.remove(
        "oculto"
    );

    modalFuncionario.classList.remove(
        "oculto"
    );

    const catalogosCargados =
        await cargarCatalogos();

    if (!catalogosCargados) {
        return;
    }

    nombres.value =
        funcionario.nombres || "";

    apellidoPaterno.value =
        funcionario.apellido_paterno || "";

    apellidoMaterno.value =
        funcionario.apellido_materno || "";

    correoInstitucional.value =
        funcionario.correo_institucional || "";

    unidadFuncionario.value =
        String(funcionario.id_unidad);

    rolFuncionario.value =
        String(funcionario.id_rol);

    estadoFuncionario.value =
        funcionario.activo
            ? "true"
            : "false";

    nombres.focus();
}

    function cerrarModal() {

        modalFuncionario.classList.add(
            "oculto"
        );

        formNuevoFuncionario.reset();
        limpiarMensaje();

        idFuncionarioEdicion = null;

        grupoEstadoFuncionario.classList.add(
            "oculto"
        );

        passwordFuncionario.required = true;
        confirmarPassword.required = true;

        btnGuardarFuncionario.disabled = false;

        btnGuardarFuncionario.textContent =
            "Crear funcionario";
    }

    formNuevoFuncionario.addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            limpiarMensaje();

            const esEdicion =
                idFuncionarioEdicion !== null;

            if (
                !esEdicion &&
                passwordFuncionario.value.length < 8
            ) {

                mostrarMensaje(
                    "La contraseña debe contener al menos 8 caracteres.",
                    "error"
                );

                return;
            }

            if (
                esEdicion &&
                passwordFuncionario.value &&
                passwordFuncionario.value.length < 8
            ) {

                mostrarMensaje(
                    "La nueva contraseña debe contener al menos 8 caracteres.",
                    "error"
                );

                return;
            }

            if (
                passwordFuncionario.value !==
                confirmarPassword.value
            ) {

                mostrarMensaje(
                    "Las contraseñas no coinciden.",
                    "error"
                );

                return;
            }

            const datos = {

                nombres:
                    nombres.value.trim(),

                apellido_paterno:
                    apellidoPaterno.value.trim(),

                apellido_materno:
                    apellidoMaterno.value.trim(),

                correo_institucional:
                    correoInstitucional.value
                        .trim()
                        .toLowerCase(),

                id_unidad:
                    Number(
                        unidadFuncionario.value
                    ),

                id_rol:
                    Number(
                        rolFuncionario.value
                    ),

                password:
                    passwordFuncionario.value
            };

            if (esEdicion) {

                datos.activo =
                    estadoFuncionario.value ===
                    "true";
            }

            const url =
                esEdicion
                    ? "/api/admin/funcionarios/" +
                      idFuncionarioEdicion
                    : "/api/admin/funcionarios";

            const metodo =
                esEdicion
                    ? "PATCH"
                    : "POST";

            btnGuardarFuncionario.disabled = true;

            btnGuardarFuncionario.textContent =
                esEdicion
                    ? "Guardando cambios..."
                    : "Creando funcionario...";

            try {

                const respuesta = await fetch(
                    url,
                    {
                        method: metodo,

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " + token
                        },

                        body:
                            JSON.stringify(datos)
                    }
                );

                const resultado =
                    await respuesta.json();

                if (respuesta.status === 401) {

                    sessionStorage.clear();

                    window.location.href = "/";
                    return;
                }

                if (!respuesta.ok) {

                    throw new Error(
                        resultado.error ||
                        (
                            esEdicion
                                ? "No fue posible actualizar el funcionario."
                                : "No fue posible crear el funcionario."
                        )
                    );
                }

                mostrarMensaje(
                    esEdicion
                        ? "Funcionario actualizado correctamente."
                        : "Funcionario creado correctamente.",
                    "exito"
                );

                await cargarFuncionarios();

                setTimeout(
                    function () {

                        cerrarModal();

                    },
                    1200
                );

            } catch (error) {

                console.error(
                    "Error al guardar funcionario:",
                    error
                );

                mostrarMensaje(
                    error.message,
                    "error"
                );

            } finally {

                btnGuardarFuncionario.disabled =
                    false;

                btnGuardarFuncionario.textContent =
                    esEdicion
                        ? "Guardar cambios"
                        : "Crear funcionario";
            }
        }
    );

    function mostrarMensaje(texto, tipo) {

        mensajeFuncionario.textContent =
            texto;

        mensajeFuncionario.className =
            "form-message " +
            (
                tipo === "exito"
                    ? "mensaje-exito"
                    : "mensaje-error"
            );
    }

    function limpiarMensaje() {

        mensajeFuncionario.textContent = "";

        mensajeFuncionario.className =
            "form-message";
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

    btnNuevoFuncionario.addEventListener(
        "click",
        abrirModalCrear
    );

    btnCerrarModal.addEventListener(
        "click",
        cerrarModal
    );

    btnCancelarFuncionario.addEventListener(
        "click",
        cerrarModal
    );

    modalFuncionario.addEventListener(
        "click",
        function (evento) {

            if (evento.target === modalFuncionario) {
                cerrarModal();
            }
        }
    );

    document.addEventListener(
        "keydown",
        function (evento) {

            if (
                evento.key === "Escape" &&
                !modalFuncionario.classList.contains(
                    "oculto"
                )
            ) {
                cerrarModal();
            }
        }
    );

    btnCerrarSesion.addEventListener(
        "click",
        function () {

            sessionStorage.clear();

            window.location.href = "/";
        }
    );

    cargarFuncionarios();

});