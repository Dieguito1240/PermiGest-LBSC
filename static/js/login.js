const formulario = document.getElementById("login-form");
const mensaje = document.getElementById("mensaje-login");

formulario.addEventListener("submit", async function (event) {
    event.preventDefault();

    const correo = document.getElementById("correo").value.trim();
    const password = document.getElementById("password").value;

    mensaje.textContent = "";

    try {
        const respuesta = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                correo: correo,
                password: password
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mensaje.textContent =
                datos.error || "No fue posible iniciar sesión.";
            return;
        }

        sessionStorage.setItem(
            "access_token",
            datos.access_token
        );

        sessionStorage.setItem(
            "usuario",
            JSON.stringify(datos.usuario)
        );

        mensaje.style.color = "var(--success)";
        mensaje.textContent = "Inicio de sesión correcto.";

        setTimeout(() => {
            window.location.href = "/dashboard";
        }, 500);

    } catch (error) {
        mensaje.textContent =
            "No fue posible conectar con el servidor.";
    }
});