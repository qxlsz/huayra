# Huayra

Public fork of [zanneth/huayra](https://code.zanneth.com/zanneth/huayra) — a dense AI coding-agent frontend.

**Credit.** Original design, CEF desktop host, OpenCode integration, and Codex Micro support are by [zanneth](https://code.zanneth.com/zanneth), MIT License, copyright 2026 zanneth. This repository keeps that license notice.

**This fork** (Raj Josyula / [qxlsz](https://github.com/qxlsz)) adds a hostable web console, Grok + Cursor project providers, desktop packaging notes for macOS / Ubuntu / Windows, and a VPS Docker path.

## What it is

Huayra is a keyboard-first agent console: projects, sessions, streaming transcripts, tool cards, and a worktree diff rail. Upstream is a vanilla TypeScript SPA inside CEF on Linux. This tree ships the same interaction model as a web app you can run locally, on a VPS, or wrap as a desktop window.

## Providers

| Provider | Role |
| --- | --- |
| Demo | Offline harness for UI and packaging |
| Grok | xAI chat (`grok-4.5`) via server-side `XAI_API_KEY` |
| OpenCode | Attach `opencode serve` (default `http://127.0.0.1:4096`) |
| Cursor | Same session chrome; repo includes `AGENTS.md` + `.cursor/rules` |

## Web

```sh
npm install
npm run dev
```

## Desktop

See `packaging/README.md`. Electron wrapper targets macOS, Ubuntu, and Windows against the same frontend.

## VPS

```sh
docker compose -f packaging/docker-compose.yml up -d
```

## License

MIT. Copyright (c) 2026 zanneth. Additional documentation and hosting adapters in this fork follow the same license.
