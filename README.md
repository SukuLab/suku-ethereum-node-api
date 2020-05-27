# SUKU - Ethereum Node API
This is the SUKU Ethereum Node API, a NodeJS REST API that can be used to abstract access to Ethereum based blockchain nodes such as Geth, Quorum Geth, Ganache, etc.

Use this package to deploy a REST API that you can use to send transactions, deploy smart contracts, call smart contract functions, and manage Node Accounts.

This package supports sending pre-signed transactions and unsigned transactions, for the latter the private key needs to be specified as an env var in the node.

## How to use this for your Ethereum project
Deploy this package to a server to get REST-based access to your Ethereum node. 

## Running the example
Make sure to check out our [example](examples/ERC721-example.ts) in `./examples/ERC721-example.ts`. It shows how to use the Node API to deploy and test an ERC721 contract. Here's how to use it:

1. Make sure that your env variables are set. You need to set `CONNECTION_STRING` and `PRIVATE_KEY`.
2. Start the API with `npm start`.
3. Run the example with `npm run example`.

## Building the docker image:
```
docker build .
```

## Running the container:
The docker image expect two env variables to be set:
- `CONNECTION_STRING` needs to be a websocket connection string to a geth node
- `PRIVATE_KEY` needs to be an Ethereum private key

Set the `PORT` variable if you want to define the port that the NodeJS Application is listening on. The default port is 3000.

```
docker run -e CONNECTION_STRING=https://localhost:8545/ -e PRIVATE_KEY=<private_key> -p 3000:3000 <container_name>
```

# Contributing & Community
If you find things that you'd like to improve in this repo feel free to create a PR or an issue. Please read our [Contribution Guidelines](CONTRIBUTING.md) before submitting an issue or a PR. 
- [Slack](https://sukudevs.slack.com)
- [Reddit](https://www.reddit.com/r/SUKUecosystem/)


