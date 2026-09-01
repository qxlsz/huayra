# Huayra agent notes

This repository is a public fork of zanneth/huayra.

- Credit zanneth for the original CEF frontend, OpenCode client, and Codex Micro host.
- Keep the UI dark, dense, and terminal-like.
- Web app lives in `src/`. Do not drop PreviewHostBridge or the Grok PWA injector when editing the hosted console.
- OpenCode default server: http://127.0.0.1:4096
- Grok calls are server-only via XAI_API_KEY. Never expose the key to the client.
- Cursor agents should treat AGENTS.md and packaging/ as source of truth for hosting.
