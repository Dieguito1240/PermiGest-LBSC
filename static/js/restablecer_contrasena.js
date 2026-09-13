document.addEventListener("DOMContentLoaded", function () {

    const form =
        document.getElementById(
            "formRestablecerPassword"
        );

    const nuevaPassword =
        document.getElementById(
            "nuevaPassword"
        );

    const confirmarPassword =
        document.getElementById(
            "confirmarNuevaPassword"
        );

    const mensaje =
        document.getElementById(
            "mensajeRestablecer"
        );

    const boton =
        document.getElementById(
            "btnRestablecer"
        );


    const parametros =
        new URLSearchParams(
            window.location.search
        );

    const token =
        parametros.get("token");


    function mostrarMensaje(
        texto,
        tipo
    ) {

        mensaje.textContent = texto;

        mensaje.className =
            "form-message " + tipo;
    }


    if (!token) {

        mostrarMensaje(
            "El enlace de recuperación no es válido.",
            "error"
        );

        boton.disabled = true;

        return;
    }


    form.addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            mensaje.textContent = "";
            mensaje.className =
                "form-message";


            if (
                nuevaPassword.value.length < 8
            ) {

                mostrarMensaje(
                    "La contraseña debe contener al menos 8 caracteres.",
                    "error"
                );

                return;
            }


            if (
                nuevaPassword.value !==
                confirmarPassword.value
            ) {

                mostrarMensaje(
                    "Las contraseñas no coinciden.",
                    "error"
                );

                return;
            }


            boton.disabled = true;

            boton.textContent =
                "Actualizando...";


            try {

                const respuesta =
                    await fetch(
                        "/api/auth/restablecer-password",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                token: token,
                                password:
                                    nuevaPassword.value
                            })
                        }
                    );


                const datos =
                    await respuesta.json();


                if (!respuesta.ok) {

                    throw new Error(
                        datos.error ||
                        "No fue posible actualizar la contraseña."
                    );
                }


                mostrarMensaje(
                    datos.mensaje,
                    "success"
                );


                form.reset();

                boton.disabled = true;

                boton.textContent =
                    "Contraseña actualizada";


                setTimeout(
                    function () {

                        window.location.href =
                            "/";

                    },
                    2500
                );


            } catch (error) {

                mostrarMensaje(
                    error.message,
                    "error"
                );

                boton.disabled = false;

                boton.textContent =
                    "Actualizar contraseña";
            }
        }
    );

});