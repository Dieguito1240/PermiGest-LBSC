document.addEventListener("DOMContentLoaded", function () {

    const token = sessionStorage.getItem("access_token");
    const usuarioGuardado = sessionStorage.getItem("usuario");

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

    const nombreUsuario =
        document.getElementById("nombre-usuario");

    const rolUsuario =
        document.getElementById("rol-usuario");

    const btnLogout =
        document.getElementById("btn-logout");

    const navNuevaSolicitud =
        document.getElementById("navNuevaSolicitud");

    const navSolicitudesAdmin =
        document.getElementById("navSolicitudesAdmin");

    const navFuncionarios =
        document.getElementById("navFuncionarios");

    const navEstadisticas =
        document.getElementById("navEstadisticas");

    const navAuditoria =
        document.getElementById("navAuditoria");

    const formPerfil =
        document.getElementById("formPerfil");

    const perfilNombres =
        document.getElementById("perfilNombres");

    const perfilApellidoPaterno =
        document.getElementById("perfilApellidoPaterno");

    const perfilApellidoMaterno =
        document.getElementById("perfilApellidoMaterno");

    const perfilCorreo =
        document.getElementById("perfilCorreo");

    const perfilUnidad =
        document.getElementById("perfilUnidad");

    const perfilRol =
        document.getElementById("perfilRol");

    const perfilUltimoAcceso =
        document.getElementById("perfilUltimoAcceso");

    const mensajePerfil =
        document.getElementById("mensajePerfil");

    const btnGuardarPerfil =
        document.getElementById("btnGuardarPerfil");

    const formCambiarPassword =
        document.getElementById("formCambiarPassword");

    const passwordActual =
        document.getElementById("passwordActual");

    const nuevaPasswordPerfil =
        document.getElementById("nuevaPasswordPerfil");

    const confirmarPasswordPerfil =
        document.getElementById("confirmarPasswordPerfil");

    const mensajePassword =
        document.getElementById("mensajePassword");

    const btnCambiarPassword =
        document.getElementById("btnCambiarPassword");


    nombreUsuario.textContent =
        usuario.nombre || "Usuario";

    rolUsuario.textContent =
        usuario.rol || "Perfil";


    if (usuario.rol === "Administrador") {

        if (navNuevaSolicitud) {
            navNuevaSolicitud.style.display = "none";
        }

    } else {

        if (navSolicitudesAdmin) {
            navSolicitudesAdmin.style.display = "none";
        }

        if (navFuncionarios) {
            navFuncionarios.style.display = "none";
        }

        if (navEstadisticas) {
            navEstadisticas.style.display = "none";
        }

        if (navAuditoria) {
            navAuditoria.style.display = "none";
        }
    }


    function mostrarMensaje(
        elemento,
        texto,
        tipo
    ) {

        elemento.textContent = texto;

        elemento.className =
            "form-message " + tipo;
    }


    function limpiarMensaje(elemento) {

        elemento.textContent = "";
        elemento.className = "form-message";
    }


    async function cargarPerfil() {

        try {

            const respuesta = await fetch(
                "/api/perfil",
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            "Bearer " + token
                    }
                }
            );

            const datos =
                await respuesta.json();

            if (
                respuesta.status === 401 ||
                respuesta.status === 422
            ) {
                sessionStorage.clear();
                window.location.href = "/";
                return;
            }

            if (!respuesta.ok) {
                throw new Error(
                    datos.error ||
                    "No fue posible cargar la cuenta."
                );
            }

            const perfil = datos.perfil;

            perfilNombres.value =
                perfil.nombres || "";

            perfilApellidoPaterno.value =
                perfil.apellido_paterno || "";

            perfilApellidoMaterno.value =
                perfil.apellido_materno || "";

            perfilCorreo.value =
                perfil.correo_institucional || "";

            perfilUnidad.value =
                perfil.unidad || "";

            perfilRol.value =
                perfil.rol || "";

            perfilUltimoAcceso.textContent =
                perfil.ultimo_acceso ||
                "Sin registro";

        } catch (error) {

            mostrarMensaje(
                mensajePerfil,
                error.message,
                "error"
            );
        }
    }


    formPerfil.addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            limpiarMensaje(
                mensajePerfil
            );

            const nombres =
                perfilNombres.value.trim();

            const apellidoPaterno =
                perfilApellidoPaterno.value.trim();

            const apellidoMaterno =
                perfilApellidoMaterno.value.trim();

            if (!nombres) {

                mostrarMensaje(
                    mensajePerfil,
                    "El nombre es obligatorio.",
                    "error"
                );

                return;
            }

            if (!apellidoPaterno) {

                mostrarMensaje(
                    mensajePerfil,
                    "El apellido paterno es obligatorio.",
                    "error"
                );

                return;
            }

            btnGuardarPerfil.disabled = true;

            btnGuardarPerfil.textContent =
                "Guardando...";

            try {

                const respuesta = await fetch(
                    "/api/perfil",
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " + token
                        },

                        body: JSON.stringify({
                            nombres: nombres,
                            apellido_paterno:
                                apellidoPaterno,
                            apellido_materno:
                                apellidoMaterno
                        })
                    }
                );

                const datos =
                    await respuesta.json();

                if (!respuesta.ok) {

                    throw new Error(
                        datos.error ||
                        "No fue posible guardar los cambios."
                    );
                }

                usuario.nombre =
                    nombres +
                    " " +
                    apellidoPaterno;

                sessionStorage.setItem(
                    "usuario",
                    JSON.stringify(usuario)
                );

                nombreUsuario.textContent =
                    usuario.nombre;

                mostrarMensaje(
                    mensajePerfil,
                    datos.mensaje,
                    "success"
                );

            } catch (error) {

                mostrarMensaje(
                    mensajePerfil,
                    error.message,
                    "error"
                );

            } finally {

                btnGuardarPerfil.disabled = false;

                btnGuardarPerfil.textContent =
                    "Guardar cambios";
            }
        }
    );


    formCambiarPassword.addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            limpiarMensaje(
                mensajePassword
            );

            const actual =
                passwordActual.value;

            const nueva =
                nuevaPasswordPerfil.value;

            const confirmacion =
                confirmarPasswordPerfil.value;


            if (!actual) {

                mostrarMensaje(
                    mensajePassword,
                    "Debe ingresar su contraseña actual.",
                    "error"
                );

                return;
            }


            if (nueva.length < 8) {

                mostrarMensaje(
                    mensajePassword,
                    "La nueva contraseña debe contener al menos 8 caracteres.",
                    "error"
                );

                return;
            }


            if (nueva !== confirmacion) {

                mostrarMensaje(
                    mensajePassword,
                    "Las contraseñas nuevas no coinciden.",
                    "error"
                );

                return;
            }


            btnCambiarPassword.disabled = true;

            btnCambiarPassword.textContent =
                "Actualizando...";


            try {

                const respuesta = await fetch(
                    "/api/perfil/cambiar-password",
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " + token
                        },

                        body: JSON.stringify({
                            password_actual:
                                actual,

                            nueva_password:
                                nueva
                        })
                    }
                );

                const datos =
                    await respuesta.json();


                if (!respuesta.ok) {

                    throw new Error(
                        datos.error ||
                        "No fue posible cambiar la contraseña."
                    );
                }


                formCambiarPassword.reset();

                mostrarMensaje(
                    mensajePassword,
                    datos.mensaje,
                    "success"
                );

            } catch (error) {

                mostrarMensaje(
                    mensajePassword,
                    error.message,
                    "error"
                );

            } finally {

                btnCambiarPassword.disabled =
                    false;

                btnCambiarPassword.textContent =
                    "Actualizar contraseña";
            }
        }
    );


    btnLogout.addEventListener(
        "click",
        function () {

            sessionStorage.clear();

            window.location.href = "/";
        }
    );


    cargarPerfil();

});