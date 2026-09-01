# Packaging

## Electron (macOS, Ubuntu, Windows)

`electron/` is a thin window around the hosted frontend.

```sh
cd packaging/electron
npm install
HUAYRA_URL=https://your-host npm start
```

Build installers with electron-builder on a machine that has platform toolchains:

- macOS: `.dmg` / `.app`
- Ubuntu: `.AppImage` / `.deb`
- Windows: `.exe` nsis

Upstream zanneth still ships the CEF + Docker AppImage path for native Linux.

## VPS

`docker-compose.yml` runs the web console behind port 8080. Put Caddy or nginx in front with TLS.
