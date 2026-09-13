document.addEventListener("DOMContentLoaded", function () {

    const form =
        document.getElementById(
            "formRecuperarPassword"
        );

    const correo =
        document.getElementById(
            "correoRecuperacion"
        );

    const mensaje =
        document.getElementById(
            "mensajeRecuperacion"
        );

    const boton =
        document.getElementById(
            "btnRecuperar"
        );


    function mostrarMensaje(
        texto,
        tipo
    ) {

        mensaje.textContent = texto;

        mensaje.className =
            "form-message " + tipo;
    }


    form.addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            mensaje.textContent = "";
            mensaje.className =
                "form-message";

            const correoValor =
                correo.value
                    .trim()
                    .toLowerCase();

            if (!correoValor) {

                mostrarMensaje(
                    "Debe ingresar su correo institucional.",
                    "error"
                );

                return;
            }

            boton.disabled = true;

            boton.textContent =
                "Enviando...";

            try {

                const respuesta =
                    await fetch(
                        "/api/auth/recuperar-password",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                correo:
                                    correoValor
                            })
                        }
                    );

                const datos =
                    await respuesta.json();

                if (!respuesta.ok) {

                    throw new Error(
                        datos.error ||
                        "No fue posible procesar la solicitud."
                    );
                }

                mostrarMensaje(
                    datos.mensaje,
                    "success"
                );

                form.reset();

            } catch (error) {

                mostrarMensaje(
                    error.message,
                    "error"
                );

            } finally {

                boton.disabled = false;

                boton.textContent =
                    "Enviar enlace de recuperación";
            }
        }
    );

});