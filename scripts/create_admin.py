from __future__ import annotations

from datetime import datetime, timezone
from getpass import getpass
from pathlib import Path
import sys

# Al ejecutar `python scripts/create_admin.py`, Python toma `scripts/` como
# directorio de importación. Agregamos la raíz del repositorio de forma
# explícita para que `backend` funcione igual en Windows, macOS y Linux.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import Settings
from backend.database import initialize, transaction
from backend.security import hash_password


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def main() -> None:
    settings = Settings.load()
    initialize(settings)
    print("Crear / actualizar administrador de Tips")
    email = input("Correo: ").strip().lower()
    name = input("Nombre visible: ").strip()
    if not email or "@" not in email:
        raise SystemExit("Correo inválido.")
    if len(name) < 2:
        raise SystemExit("El nombre visible debe tener al menos 2 caracteres.")

    password = getpass("Contraseña (mínimo 12 caracteres): ")
    password_hash = hash_password(password)
    stamp = now()

    with transaction(settings) as db:
        existing = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if existing:
            db.execute(
                "UPDATE users SET password_hash=?,display_name=?,role='admin',is_active=1,failed_login_count=0,locked_until=NULL,updated_at=? WHERE id=?",
                (password_hash, name, stamp, existing["id"]),
            )
            print("Administrador actualizado correctamente.")
        else:
            db.execute(
                "INSERT INTO users(email,password_hash,display_name,role,is_active,created_at,updated_at) VALUES(?,?,?,'admin',1,?,?)",
                (email, password_hash, name, stamp, stamp),
            )
            print("Administrador creado correctamente.")

    print("Ahora inicia el servidor con: python app.py")
    print("Luego entra a: http://127.0.0.1:8000/cuenta.html")


if __name__ == "__main__":
    main()
