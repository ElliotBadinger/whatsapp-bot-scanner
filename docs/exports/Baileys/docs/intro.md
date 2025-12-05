# Source: https://baileys.wiki/docs/intro

<!-- Scraped from https://baileys.wiki/docs/intro -->

[Skip to main content](https://baileys.wiki/docs/intro/#__docusaurus_skipToContent_fallback)
[![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")

- [Introduction](https://baileys.wiki/docs/intro)
- [Migrate to v7.x.x](https://baileys.wiki/docs/migration/to-v7.0.0)
- [Socket](https://baileys.wiki/docs/category/socket)
- [FAQs](https://baileys.wiki/docs/faq)

- [](https://baileys.wiki/)
- Introduction

On this page

# Documentation

This guide is a work in progress and does not reflect the full functionality or the final/current state of the Baileys project.
Baileys is a WhatsApp Web API automation TypeScript library (Node supported, web/extension support planned). This project doesn't control WhatsApp using an automated browser, but instead uses WhatsApp Web's WebSocket-based protocol to interact with WhatsApp servers.
If you don't use TypeScript or JavaScript, it is recommended to learn them before using this library.
Baileys **does not** use the WhatsApp Business API ([WABA](https://developers.facebook.com/docs/whatsapp/overview/business-accounts/)). Rather it connects to a personal or a business (mobile app) account using the [Linked Devices](https://faq.whatsapp.com/378279804439436) feature.
Yes, this means that this project is in no way affiliated with or endorsed by WhatsApp. Use at your own discretion. Do not spam people with this. We discourage any stalkerware, bulk or automated messaging usage.

## Installation[​](https://baileys.wiki/docs/intro/#installation "Direct link to Installation")

Adding Baileys to your project is as simple as:

- npm
- Yarn
- pnpm
- Bun

```
npm install baileys

```

```
yarn add baileys

```

```
pnpm add baileys

```

```
bun add baileys

```

As of now, Baileys requires **Node 17+** to function. It is planned to abstract the project away from Node in a future releasae.
Since NPM/Yarn releases are on a semi-monthly basis, you can use the GitHub branch directly

## Synopsis[​](https://baileys.wiki/docs/intro/#synopsis "Direct link to Synopsis")

The main export of the Baileys library (and the default one) is the [`makeWASocket`](https://baileys.wiki/docs/api/functions/makeWASocket) function.
This export returns an object full of socket-related functions. You can use these to interact with WhatsApp.
The socket is also an extension of an [EventEmitter](https://nodejs.org/docs/latest/api/events.html#class-eventemitter). You can listen to the events it emits to collect and store data. Baileys is asynchronous and event-based.
The socket authenticates with WhatsApp Web using the ["Auth state"](https://baileys.wiki/docs/api/type-aliases/AuthenticationState), that you provide in the [config](https://baileys.wiki/docs/api/type-aliases/UserFacingSocketConfig). For this guide, we'll be using the [`useMultiFileAuthState`](https://baileys.wiki/docs/api/functions/useMultiFileAuthState) to create this auth state.
The auth state should be implemented from scratch, taking the built-in `useMultiFileAuthState` function as an inspiration. DO NOT rely on it in prod! It is very inefficient and is purely for demo purposes.
Next, we'll be learning in specific about the Socket type, and how to use its functions!
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/intro.md)
[Next Migrate to v7.x.x](https://baileys.wiki/docs/migration/to-v7.0.0)

- [Installation](https://baileys.wiki/docs/intro/#installation)
- [Synopsis](https://baileys.wiki/docs/intro/#synopsis)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
