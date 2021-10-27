# Moralis Mutants NFT Collection | Generative Art Engine

🧟‍♀️🧟‍♂️ Welcome to Rekt City on behalf of its horribly mutated survivors. 🧟‍♀️🧟‍♂️

## About

Aim: Save time and resources for artists and developers by allowing them to generate and host NFT art, across blockchains, in one place (utilising Moralis).

This initial tutorial video is a great introduction: [Link to Moralis YouTube Video](https://www.youtube.com/watch?v=KBV4FrCv4ps).

## Quick Launch 🚀

Via terminal, navigate to root directory:

```sh
npm install

```

Go to [Moralis.io](https://moralis.io/) to create your server instance. Then in root `index.js` file, point to your Moralis server:

```sh
const appId = "YOUR_MORALIS_APP_ID";
const serverUrl = "YOUR_MORALIS_SERVER_URL";
const masterKey = "YOUR_MORALIS_MASTER_KEY"; // DO NOT DISPLAY IN PUBLIC DIR

```

Create your layered artwork and split into folders in `./input` and configure your collection to match your layer structure and preferences accordingly by editing `./input/config.js`:

Finally, via terminal in the project directory run:

```sh
node index.js

```

This injects the mutagen that will bring your Moralis mutants ALIVE!

## Dependencies 🏗

`moralis`: [ℹ️ Docs](https://docs.moralis.io/)

`canvas`: [ℹ️ Docs](https://www.npmjs.com/package/canvas)

## Todos ✅

- [ ] NFT contract allowing tokens to be minted and tranferred for Opensea.
- [ ] Users can mint NFT collection via custom dapp frontend.
- [ ] Compatibility across-chains (SOL/MATIC).
- [ ] Much more TBA.

## Community BUIDLing 👨‍🔧👩‍🔧

- [Moralis Forum](https://forum.moralis.io/)
- [Moralis Discord](https://discord.com/channels/819584798443569182)
- [Moralis GitHub](https://github.com/MoralisWeb3)
- [Moralis YouTube](https://www.youtube.com/channel/UCgWS9Q3P5AxCWyQLT2kQhBw)
