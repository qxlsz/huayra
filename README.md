# Huayra ADE

Agent development environment for a fleet of coding agents. Install it on your machine, run it on a VPS or a cloud VM, steer the same fleet from a phone browser.

**Created by Charles ([@zanneth](https://x.com/zanneth)).**  
Upstream: [code.zanneth.com/zanneth/huayra](https://code.zanneth.com/zanneth/huayra)  
MIT License, copyright 2026 zanneth. This fork keeps that notice.

Fork: Raj Josyula ([qxlsz](https://github.com/qxlsz)).

## What it is

Upstream Huayra is a dense TypeScript + CEF frontend for OpenCode. This fork is a hostable ADE: parallel worktrees, OpenCode / OpenCode 2 / OMP / Pi / Prime / Grok / Cursor / custom engines, a passphrase gate, phone companion, telemetry off by default.

## Quick start

```sh
npm install
npm run dev
```

Set a passphrase in Config → Host before sharing an origin. Desktop and Docker: `packaging/`.

## Run it

- Machine — clone or Electron wrap; agents stay in local worktrees
- Cloud — Grok VM or Cursor Cloud Agent on this repo
- Phone — open the same origin; pair code in Config → Connect

## Playground

https://huayra-qxlsz1s-projects.vercel.app

## License

MIT. Copyright (c) 2026 zanneth. [x.com/zanneth](https://x.com/zanneth)
