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



if (usuario.rol !== "Funcionario") {

    window.location.href = "/dashboard";

    throw new Error(
        "Esta función está disponible para funcionarios."
    );
}



const nombreUsuario =
    document.getElementById("nombre-usuario");

const rolUsuario =
    document.getElementById("rol-usuario");

const formulario =
    document.getElementById("solicitud-form");

const tipoPermiso =
    document.getElementById("tipo-permiso");

const modalidad =
    document.getElementById("modalidad");

const modalidadVisible =
    document.getElementById("modalidad-visible");

const fechaInicio =
    document.getElementById("fecha-inicio");

const fechaTermino =
    document.getElementById("fecha-termino");

const horaInicio =
    document.getElementById("hora-inicio");

const horaTermino =
    document.getElementById("hora-termino");

const grupoHoraInicio =
    document.getElementById("grupo-hora-inicio");

const grupoHoraTermino =
    document.getElementById("grupo-hora-termino");

const observacion =
    document.getElementById("observacion");

const requiereReemplazo =
    document.getElementById("requiere-reemplazo");

const mensaje =
    document.getElementById("mensaje-solicitud");




if (nombreUsuario) {

    nombreUsuario.textContent =
        usuario.nombre || "Usuario";
}


if (rolUsuario) {

    rolUsuario.textContent =
        usuario.rol || "Funcionario";
}



if (grupoHoraInicio) {
    grupoHoraInicio.style.display = "none";
}

if (grupoHoraTermino) {
    grupoHoraTermino.style.display = "none";
}



function mostrarError(texto) {

    if (!mensaje) {
        return;
    }

    mensaje.className =
        "mensaje-solicitud mensaje-error";

    mensaje.textContent = texto;
}


function mostrarExito(texto) {

    if (!mensaje) {
        return;
    }

    mensaje.className =
        "mensaje-solicitud mensaje-exito";

    mensaje.textContent = texto;
}


function limpiarMensaje() {

    if (!mensaje) {
        return;
    }

    mensaje.className =
        "mensaje-solicitud";

    mensaje.textContent = "";
}



async function cargarTiposPermiso() {

    try {

        const respuesta =
            await fetch(
                "/api/tipos-permiso",
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


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            mostrarError(
                datos.error ||
                "No fue posible cargar los tipos de permiso."
            );

            return;
        }


        let tipos = [];


        if (Array.isArray(datos)) {

            tipos = datos;

        } else if (
            datos &&
            Array.isArray(datos.tipos)
        ) {

            tipos = datos.tipos;

        } else if (
            datos &&
            Array.isArray(datos.tipos_permiso)
        ) {

            tipos = datos.tipos_permiso;
        }


        tipoPermiso.innerHTML = `
            <option value="">
                Seleccione un tipo de permiso
            </option>
        `;


        tipos.forEach(function (tipo) {

            const opcion =
                document.createElement("option");


            opcion.value =
                tipo.id_tipo_permiso;


            opcion.textContent =
                tipo.nombre;


            opcion.dataset.requiereHorario =
                tipo.requiere_horario
                    ? "true"
                    : "false";


            opcion.dataset.unidadControl =
                tipo.unidad_control || "";


            tipoPermiso.appendChild(opcion);
        });


        if (tipos.length === 0) {

            mostrarError(
                "No existen tipos de permiso activos."
            );
        }


    } catch (error) {

        console.error(
            "Error al cargar tipos de permiso:",
            error
        );

        mostrarError(
            "No fue posible conectar con el servidor."
        );
    }
}



tipoPermiso.addEventListener(
    "change",
    function () {

        limpiarMensaje();


        const opcion =
            tipoPermiso.options[
                tipoPermiso.selectedIndex
            ];


        if (!opcion.value) {

            modalidad.value = "";

            modalidadVisible.value =
                "Seleccione un tipo de permiso";


            grupoHoraInicio.style.display =
                "none";

            grupoHoraTermino.style.display =
                "none";


            horaInicio.required = false;
            horaTermino.required = false;

            horaInicio.value = "";
            horaTermino.value = "";

            return;
        }


        const requiereHorario =
            opcion.dataset.requiereHorario ===
            "true";


        if (requiereHorario) {

            modalidad.value = "HORAS";

            modalidadVisible.value =
                "Por horas";


            grupoHoraInicio.style.display =
                "";

            grupoHoraTermino.style.display =
                "";


            horaInicio.required = true;
            horaTermino.required = true;


            /*
               Un permiso por horas se realiza
               dentro de la misma fecha.
            */

            if (fechaInicio.value) {

                fechaTermino.value =
                    fechaInicio.value;
            }


        } else {

            modalidad.value =
                "DIA_COMPLETO";

            modalidadVisible.value =
                "Día completo";


            grupoHoraInicio.style.display =
                "none";

            grupoHoraTermino.style.display =
                "none";


            horaInicio.required = false;
            horaTermino.required = false;


            horaInicio.value = "";
            horaTermino.value = "";
        }
    }
);


fechaInicio.addEventListener(
    "change",
    function () {

        if (
            modalidad.value === "HORAS"
        ) {

            fechaTermino.value =
                fechaInicio.value;
        }
    }
);



function calcularDias(
    inicio,
    termino
) {

    const inicioPartes =
        inicio.split("-");

    const terminoPartes =
        termino.split("-");


    const inicioUTC =
        Date.UTC(
            Number(inicioPartes[0]),
            Number(inicioPartes[1]) - 1,
            Number(inicioPartes[2])
        );


    const terminoUTC =
        Date.UTC(
            Number(terminoPartes[0]),
            Number(terminoPartes[1]) - 1,
            Number(terminoPartes[2])
        );


    const diferencia =
        terminoUTC - inicioUTC;


    return Math.floor(
        diferencia / 86400000
    ) + 1;
}


function calcularHoras(
    inicio,
    termino
) {

    const inicioPartes =
        inicio.split(":");

    const terminoPartes =
        termino.split(":");


    const minutosInicio =
        Number(inicioPartes[0]) * 60 +
        Number(inicioPartes[1]);


    const minutosTermino =
        Number(terminoPartes[0]) * 60 +
        Number(terminoPartes[1]);


    const diferencia =
        minutosTermino - minutosInicio;


    return diferencia / 60;
}



function validarFormulario() {

    if (!tipoPermiso.value) {

        mostrarError(
            "Debe seleccionar un tipo de permiso."
        );

        return false;
    }


    if (!fechaInicio.value) {

        mostrarError(
            "Debe seleccionar la fecha de inicio."
        );

        return false;
    }


    if (!fechaTermino.value) {

        mostrarError(
            "Debe seleccionar la fecha de término."
        );

        return false;
    }


    if (
        fechaTermino.value <
        fechaInicio.value
    ) {

        mostrarError(
            "La fecha de término no puede ser anterior a la fecha de inicio."
        );

        return false;
    }


    if (
        modalidad.value === "HORAS"
    ) {

        if (
            fechaInicio.value !==
            fechaTermino.value
        ) {

            mostrarError(
                "Los permisos por horas deben comenzar y terminar el mismo día."
            );

            return false;
        }


        if (
            !horaInicio.value ||
            !horaTermino.value
        ) {

            mostrarError(
                "Debe indicar la hora de inicio y término."
            );

            return false;
        }


        const cantidadHoras =
            calcularHoras(
                horaInicio.value,
                horaTermino.value
            );


        if (cantidadHoras <= 0) {

            mostrarError(
                "La hora de término debe ser posterior a la hora de inicio."
            );

            return false;
        }
    }


    return true;
}


formulario.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        limpiarMensaje();


        if (!validarFormulario()) {

            return;
        }


        const datosSolicitud = {

            id_tipo_permiso:
                Number(
                    tipoPermiso.value
                ),

            fecha_inicio:
                fechaInicio.value,

            fecha_termino:
                fechaTermino.value,

            modalidad:
                modalidad.value,

            observacion:
                observacion.value.trim(),

            requiere_reemplazo:
                requiereReemplazo.checked
        };



        if (
            modalidad.value ===
            "DIA_COMPLETO"
        ) {

            datosSolicitud.cantidad_dias =
                calcularDias(
                    fechaInicio.value,
                    fechaTermino.value
                );


            datosSolicitud.cantidad_horas =
                null;

            datosSolicitud.hora_inicio =
                null;

            datosSolicitud.hora_termino =
                null;
        }



        if (
            modalidad.value ===
            "HORAS"
        ) {

            datosSolicitud.hora_inicio =
                horaInicio.value;

            datosSolicitud.hora_termino =
                horaTermino.value;


            datosSolicitud.cantidad_horas =
                calcularHoras(
                    horaInicio.value,
                    horaTermino.value
                );


            datosSolicitud.cantidad_dias =
                null;
        }


        try {

            const boton =
                formulario.querySelector(
                    'button[type="submit"]'
                );


            if (boton) {

                boton.disabled = true;
                boton.textContent =
                    "Enviando...";
            }


            const respuesta =
                await fetch(
                    "/api/solicitudes",
                    {
                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " + token
                        },

                        body:
                            JSON.stringify(
                                datosSolicitud
                            )
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


            const datos =
                await respuesta.json();


            if (!respuesta.ok) {

                mostrarError(
                    datos.error ||
                    datos.mensaje ||
                    "No fue posible registrar la solicitud."
                );


                if (boton) {

                    boton.disabled = false;

                    boton.textContent =
                        "Enviar solicitud";
                }

                return;
            }


            mostrarExito(
                "Solicitud registrada correctamente."
            );


            if (boton) {

                boton.textContent =
                    "Solicitud enviada";
            }


            setTimeout(
                function () {

                    window.location.href =
                        "/dashboard";

                },
                1500
            );


        } catch (error) {

            console.error(
                "Error al registrar solicitud:",
                error
            );


            mostrarError(
                "No fue posible conectar con el servidor."
            );


            const boton =
                formulario.querySelector(
                    'button[type="submit"]'
                );


            if (boton) {

                boton.disabled = false;

                boton.textContent =
                    "Enviar solicitud";
            }
        }
    }
);


cargarTiposPermiso();