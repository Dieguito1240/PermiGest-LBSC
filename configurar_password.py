import os
import getpass
import psycopg
from werkzeug.security import generate_password_hash


correo = input("Correo del usuario: ").strip()

password = getpass.getpass("Nueva contraseña de prueba: ")
confirmacion = getpass.getpass("Repita la contraseña: ")

if not password:
    print("La contraseña no puede estar vacía.")
    exit()

if password != confirmacion:
    print("Las contraseñas no coinciden.")
    exit()


password_hash = generate_password_hash(password)

try:
    conexion = psycopg.connect(
        host="localhost",
        port="5432",
        dbname="permigest_lbsc",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    cursor = conexion.cursor()

    cursor.execute("""
        UPDATE usuarios u
        SET password_hash = %s,
            fecha_actualizacion = CURRENT_TIMESTAMP
        FROM funcionarios f
        WHERE f.id_funcionario = u.id_funcionario
          AND LOWER(f.correo_institucional) = LOWER(%s)
        RETURNING u.id_usuario;
    """, (
        password_hash,
        correo
    ))

    resultado = cursor.fetchone()

    if resultado:
        conexion.commit()
        print("Contraseña configurada correctamente.")
        print("Usuario ID:", resultado[0])
    else:
        print("No se encontró un usuario asociado a ese correo.")

    cursor.close()
    conexion.close()

except Exception as error:
    print("Error:", error)