# Huayra ADE

Agent development environment for a fleet of coding agents.

**Created by Charles ([@zanneth](https://x.com/zanneth)).**  
Upstream: [code.zanneth.com/zanneth/huayra](https://code.zanneth.com/zanneth/huayra)  
MIT License, copyright 2026 zanneth. This fork keeps that notice.

Fork: Raj Josyula ([qxlsz](https://github.com/qxlsz)).

## What it is

Upstream Huayra is a dense TypeScript + CEF frontend for OpenCode. This fork is a hostable ADE: parallel worktrees, OpenCode / OpenCode 2 / OMP / Pi / Prime / Grok / Cursor / custom engines, a passphrase gate, Moshi + Herdr connect path, telemetry off by default.

Not Orca, not Moshi, not Herdr — those stay the desktop ADE, the phone tty, and the multiplexer.

## Quick start

```sh
npm install
npm run dev
```

Set a passphrase in Config → Host before sharing an origin.

## Connect

- Cloud: Grok VM or Cursor Cloud Agent on this repo
- Desktop: clone + Electron/Docker under `packaging/`
- Phone: [Moshi](https://getmoshi.app/) over SSH/Mosh
- Multiplexer:

```sh
herdr integration install opencode
herdr integration install grok
herdr integration install cursor
herdr integration install pi
herdr integration install omp
```

## Playground

https://huayra-qxlsz1s-projects.vercel.app

## License

MIT. Copyright (c) 2026 zanneth. [x.com/zanneth](https://x.com/zanneth)
