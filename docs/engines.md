# Engines and Cursor

Huayra talks to any OpenAI-compatible `/v1/chat/completions` host.

## Presets

- Grok / xAI (`https://api.x.ai/v1`, model `grok-4.5`)
- OpenAI
- OpenRouter
- Ollama (`http://127.0.0.1:11434/v1`)
- LM Studio (`http://127.0.0.1:1234/v1`)
- vLLM
- Cursor-compatible local proxy (`http://127.0.0.1:8008/v1`)

Set provider to `custom`, then base URL + model. Keys stay on the device and are proxied by the Huayra server. Localhost engines only work when the server process can reach that port (desktop / VPS), not from a public serverless host to *your* laptop.

## Cursor

This app cannot attach to a running Cursor Cloud Agent. It can:

1. Treat Cursor as a project provider with a Cursor-flavored system prompt.
2. Download `.cursor/rules` and a Cloud Agent brief from Config → Project.
3. Point that project at Grok or any custom engine.

Open https://github.com/qxlsz/huayra in Cursor and paste the brief.
