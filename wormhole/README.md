# wormhole-cosmos-experiments
A repo for investigating and learning the mechanics of cross-chain messaging using Wormhole protocol. We're especially interested in 
Cosmos -> Solana route at the moment.

## What we've done so far
* `experiments.test.js` is our first attempt at creating a client software that talks to Wormhole. We've used Wormhole Testnet as our test environment. It contains code that shows how to use `wormhole-sdk-ts` to;
  * send tokens in Solana -> Osmosis direction
  * send tokens in Osmosis -> Solana direction
  * resume a transfer given its source chain tx hash

  This file is not intended to guide other developers into the Wormhole world. It's only an internal playground that we use for ourselves.

* `localDev.test.js` focuses on a hybrid test environment where we use Wormhole's local development configuration (Tilt) BUT we connect
the Osmosis' `osmo-test-5` testnet as one of our end destination. In this file, we try to demonstrate;
  * An imaginary Solana user sends some test tokens to an Osmosis account,
  * Osmosis account sends some of the tokens back BUT it inserts an arbitrary payload in the transaction when sending it
    * Osmosis account uses IBC to initiate the transfer
    * It places the arbitrary payload into the `memo` field
    * This arbitrary payload represents the instructions to be executed on the receiving end
  * Verifies Wormhole protocol generates a VAA for this transfer
  * Verifies the arbitrary payload coming from Osmosis by parsing the VAA

* `vaaHelpers.js` contains most of our knowledge about Wormhole by supplying helper methods to create mock VAAs in order for us to 
prepare the environment for our actual test case.

* `txHelpers.js` is a helper that focuses on signing and sending transactions to Wormchain and possibly to Osmosis.

# Set environment and state (WIP)

- Spin up Wormchain  
> tilt up -- --wormchain

- Spin up Hermes relayer
> hermes --config config.toml start

- Register new channel
> hermes --config config.toml create channel --a-chain osmo-test-5 --b-chain wormchain --a-port transfer --b-port transfer --new-client-connection

- Query channels
> ./build/wormchaind q ibc channel channels --node http://localhost:26659

- Update channel info 
> yarn ava localDev.test.js -m 'update-channel-info'

- Attest token
> yarn ava localDev.test.js -m 'attest'

- Set ibcTranslator as the middleware contract (FAILING)
> yarn ava localDev.test.js -m 'mw-set-vaa'

- Register tokenBridge on globalAccountant
> yarn ava localDev.test.js -m 'register-tb-to-accountant'

- Introduce transfer vaa on globalAccountant
> yarn ava localDev.test.js -m 'introduce-transfer-vaa-to-accountant'

- Send token to Osmosis
> yarn ava localDev.test.js -m 'send-to-osmo'

- Confirm packet was relayed
> hermes --config config.toml clear packets --port transfer --channel channel-0 --chain wormchain

- Verify osmosis balance
> osmosisd q bank balances osmo19clev5t3932g0cg2c8xa5sg5n77932qec9cyuh --node https://rpc.testnet.osmosis.zone:443

- Get channel-ID and IBC denom 
> make check-wormchain-channels
> make check-osmosis-ibc-denom

- Send IBC transfer from Osmosis
> Update the test with the correct channel-ID and IBC denom 
> yarn ava localDev.test.js -m 'send-ibc-message'

```sh
make update-channel-info
make check-channel-info
make attest-token
make check-cw20-instances
make gov-set-mw
make check-mw-contract

make check-chain-registration

make check-wormchain-channels
make check-osmosis-ibc-denom
```