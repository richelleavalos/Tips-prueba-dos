from __future__ import annotations

from backend.config import Settings
from backend.database import initialize
from backend.runtime import create_server


def main() -> None:
    settings = Settings.load()
    initialize(settings)
    server = create_server(settings)
    print(f"Tips ejecutándose en http://{settings.host}:{settings.port}")
    print("Presiona Ctrl+C para detener el servidor.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
