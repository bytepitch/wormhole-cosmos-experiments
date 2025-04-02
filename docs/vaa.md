# VAA
Verifiable Action Approval (VAA) is a token of trust that contains information about
what action in the Wormhole universe is to be taken. The trust in these VAAs is created by the a special group called Guardians. See **Wormhole Components**
for further information.

## Anatomy of a VAA
All VAAs share some common data fields. 

```js
  const commons = {
    guardianSet: config.guardianSetIndex, // Number, mostly 0 for local testing
    timestamp: Math.floor(Date.now() / 1000), // Number
    nonce: random(), // Number, for randomness
    emitterChain: emitterInfo.emitterChain, // Number, wh-ts-sdk converts strings to number for us
    emitterAddress: emitterInfo.emitterAddress, // Hex encoded Wormhole Universal Address, see below note
    sequence: prevSequence ? prevSequence + 1 : random(), // represents the number of messages published by this emitter
    consistencyLevel: config.consistencyLevel, // See [The Whitepaper](https://github.com/wormhole-foundation/wormhole/blob/main/whitepapers/0001_generic_message_passing.md#consistency-levels)
    signatures: [], // List of guardian signature that signed this VAA
    payload: [], // A byte array containing information about this specific VAAs intended action
  };
```

### Note on addresses in VAAs
Wormhole has a special form of address called `UniversalAddress`. It is used to
standardize the length of address that go into the VAA. Below is how you can create 
`UniversalAddress`:

```js
import { Wormhole } from '@wormhole-foundation/sdk';

const tokenAddress = Wormhole.parseAddress('Solana', '2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ').toUniversalAddress();
```

If you want to calculate how `2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ` is going to look like in a VAA while traveling between blockchains, here's how you can calculate it:

```js
import { Wormhole } from '@wormhole-foundation/sdk';

const tokenAddress = Wormhole.parseAddress('Solana', '2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ');

console.log(Buffer.from(tokenAddress.toUniversalAddress().toUint8Array()).toString('hex')) // Prints 165809739240a0ac03b98440fe8985548e3aa683cd0d4d9df5b5659669faa301
```

This output is **32 Bytes** long and can safely be serialized/deserialized by other Wormhole components.

### Payload
The `payload` field in the VAA contains specific information about what action to be taken off of that VAA. Some of those actions are;
* Governance operations
* Initiating a transfer
* Completing a transfer
* Initiating a transfer with its own payload
* Completing a transfer with its own payload

**Do not get confused with nested payloads**
Some operations like `CompleteTransferWithPayload` include their own payload which lead to VAA layout like:

```js
{
  "version": 1,
  "guardianSetIndex": 0,
  "signatures": [
    {
      "guardianSetIndex": 0,
      "signature": "3f313ffd567b51cb8f45f8e1f06b40f884cfc46a04a5a5a08852472bb4724a7d0844443e5420cd0304f5837f265c5ba751603076f2093349400a0b321ecf180a00"
    }
  ],
  "timestamp": 1741272840,
  "nonce": 6620,
  "emitterChain": 3104,
  "emitterAddress": "0xc9138c6e5bd7a2ab79c1a87486c9d7349d064b35ac9f7498f3b207b3a61e6013",
  "sequence": "0",
  "consistencyLevel": 0,
  "payload": {
    "module": "TokenBridge",
    "type": "TransferWithPayload",
    "amount": "990000",
    "tokenAddress": "0x165809739240a0ac03b98440fe8985548e3aa683cd0d4d9df5b5659669faa301",
    "tokenChain": 1,
    "toAddress": "0xc69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f",
    "chain": 1,
    "fromAddress": "0x74f4aa42b2c6d967c041f9e83953a2b271a8708c4fa80d306d6c312686eb664f",
    "payload": "0x7b22666f6f223a22626172227d"
  },
  "digest": "0x7dc8e6f56f2c7deee326f832e0488fca40105ad98b0b281c473bbdf956df1aa9"
}
```

> What you are seeing above is a VAA that is *_parsed_*. VAAs travel as base64 encoded string that's calculated from a byte array. More on parsing VAAs later.

The inner `payload` above is specific to `TokenBridge.TransferWithPayload` operation where the outer `payload` is common for all VAAs.

## Working With VAAs
In order to make use of Wormhole's features in a test environment, one needs to be 
efficient in creating and parsing VAAs. As we said above, smart contracts usually expect their VAAs in a base64 encoded form. However this doesn't mean a VAA has to be base64 encoded. It's simply a byte array where the bytes are ordered in a certain way (serializing). These bytes can also be encoded to hexadecimal format which is the other form of a VAA you'll likely come across as you dive deeper in the Wormhole ecosystem.

### Creating VAAs
In order to create a valid VAA, you must do two things right;
* Put the data together in a serializable and deserializable way
* Make sure it is signed by a guardian

In our [vaaHelper.js](../vaaHelpers.js) we use [Wormhole's TypeScript SDK](https://github.com/wormhole-foundation/wormhole-sdk-ts) to create our VAAs. The Wormhole team
has come with the concept of `layouts` to describe characteristic of VAA items. Here's a [reference](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/core/definitions/src/protocols/governance/layout.ts) to their "governance" related VAA layouts. And here's an example layout we've created for a type of VAA the `wormhole-sdk-ts` doesn't support yet.

```js
// From https://github.com/bytepitch/wormhole-cosmos-experiments/blob/03924b59cd999acd28a1475df2a4b71fceb57a3b/vaaHelpers.js#L56-L83
{
      name: 'module',
      binary: 'bytes',
      size: 32,
      custom: {
        from: val => encoder.encode(val.padStart(32, '\0')),
        to: val => decoder.decode(val),
      },
    },
    { name: 'type', binary: 'uint', size: 1 },
    { name: 'chain', binary: 'uint', size: 2 },
    { name: 'emitterChain', binary: 'uint', size: 2 },
    {
      name: 'emitterAddress',
      binary: 'bytes',
      size: 32,
      custom: {
        to: val => new UniversalAddress(val),
        from: val => val.toUint8Array(),
      },
    },
```

Above you can see how we handle certain data structures. For example the `type` field is an unsigned 8 bit integer where `chain` is an unsigned 16 bit integer. I believe the `custom` field of `module` and `emitterAddress` is self explanatory.

Alternatively, we could have build an serialize the VAAs on our own by converting every data field in the VAA to its byte array form and concat between one another. However, we find creating the layouts and having the `wormhole-ts-sdk` do it for us more intuitive. See [vaaHelper.js](../vaaHelpers.js) for details.

### Parsing VAAs
`wormhole-sdk-ts` does provide a tool for deserializing VAAs as well. However, in our development cycle we've found parsing VAAs is more of a debugging action you sometimes have to take and not a must for programmatically carrying out a use case from a client standpoint. So we here are two useful tools for parsing a VAA:
* [Wormcsan VAA Parser](https://wormholescan.io/#/developers/vaa-parser)
* [worm cli tool](https://github.com/wormhole-foundation/wormhole/tree/main/clients/js)

## VAAs Required for Cosmos -> Solana communication
Here we talk about the VAAs that we use to; a) set up our test environment and b) initiating a transfer from an Osmosis blockchain to Solana. Some of these VAAs are for internal components of Wormhole. If you have questions see our [Components](./vaa.md) doc.

### Updating IBC Translator's known channels
We need this step in order to allow incoming ICS-20 packets from Osmosis to arrive 
`ibcTranslator` wasm contract. This is a governance action so it MUST be coming from a valid `emitterAddress`. We get this address from a file called [devnet-consts.json](https://github.com/wormhole-foundation/wormhole/blob/main/scripts/devnet-consts.json).

```js
  /**
   * @type {import('./vaaHelpers.js').EmitterInfo}
   */
  const emitterInfo = {
    emitterChain: 'Solana',
    emitterAddress: govEmitterAddress.toUniversalAddress(),
  };

  /**
   * @type {import('./vaaHelpers.js').UpdateChannelPayloadInfo}
   */
  const payloadInfo = {
    channelId: 'channel-0',
    // This should be something present in https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/80bbcd9ec0a8bbdc564c812996807b6cd98e0757/core/base/src/constants/chains.ts#L6
    channelChain: 'Osmosis',
  };

  const vaa = createUpdateChannelVAA(emitterInfo, payloadInfo, true);
```

`channelChain` is normally represented as an integer in the end VAA. However `wormhole-sdk-ts` looks up chain ids from their names. Hence you need to be careful sending a chain that already exists in the permalink above `channelChain`.

This VAA is sent to `ibcTranslator` (wormchain) contract as wasm transaction.

### Setting the IBC Middleware Contract
Two things here;
* We need to send some tokens TO Cosmos FROM Solana before doing the vice versa. This is because a known cosmos denom that we can reference in our Cosmos -> Solana transfer. Also our account must have a balance of the Solana token before it can send it.
* In order to make Solana -> Cosmos transfer happen, the wormchain needs to know the address of the wasm contract that's going to handle denom creation and routing of the tokens to end Osmosis address.

Here's how we create VAA for this;

```js
  /**
   * @type {import('./vaaHelpers.js').EmitterInfo}
   */
  const emitterInfo = {
    emitterChain: 'Solana',
    emitterAddress: govEmitterAddress.toUniversalAddress(),
  };

  /**
   * @type {import('./vaaHelpers.js').SetIbcMwPayloadInfo}
   */
  const payloadInfo = {
    chain: 'Wormchain',
    contractAddress: ibcTranslatorAddress.toUniversalAddress(),
  };

  const vaa = createSetMwVAA(emitterInfo, payloadInfo, true);
```
Two thing notice here;
* `emitterAddress` is a valid governance emitter
* `contractAddress` is the UniversalAddress of `ibcTranslator` which is 32 bytes long


This VAA is sent to wormchain and is interpreted as a chain governance action.

### Introduce Wormchain TokenBridge to the GlobalAccountant
In order to prevent double spending `globalAccount` keeps track of the transfers happening across all Wormhole ecosystem. To make this happen, it has to know who are
eligible to send transfers. To be more concrete, `globalAccount` wants to know the addressed of `tokenBridge` contracts deployed on all blockchains it supports. Here we introduce Wormchain's `tokenBridge` to it.

```js
  /**
   * @type {import('./vaaHelpers.js').EmitterInfo}
   */
  const emitterInfo = {
    emitterChain: 'Solana',
    emitterAddress: govEmitterAddress.toUniversalAddress(),
  };

  const vaa = createRegisterWormchainToAccountantVAA(
    emitterInfo,
    tokenBridgeAddress.toUniversalAddress(),
  );
```

This operation creates a VAA using the custom layout we showed earlier. So it makes sense look into  `createRegisterWormchainToAccountantVAA` and specifically the `payload` we are building:

```js
  const myCustomPayload = {
    module: 'TokenBridge', // Informs the accountant that this is TB operation
    type: 1, // Corresponds to 'RegisterChain'
    emitterChain: 3104, // Id of the chain we are letting emit transfer events
    chain: 0, // 0 means this VAA is a generic purpose one, not so important for us atm
    emitterAddress: emitterContractAddr, // Address that accountant will let emit transfer events, for our case it is TokenBridge wasm contract deployed on Wormchain
  };

  const vaa = createVAA('Uint8Array', {
    ...commons,
    payload: serializeLayout(
      registerTokenBridgeToAccountantLayout(),
      myCustomPayload,
    ),
  });
```

I believe `myCustomPayload`'s comments are pretty self explanatory. We submit output VAA to `globalAccountant` as a wasm transaction.

### Introducing Solana token to Wormchain's TokenBridge
Wormchain's `tokenBridge` has to know the incoming transfer's token is supported by Wormhole. In order to make sure of that, before sending any transfers for a specific token (in our case Solana test token) we have to attest the token for the corresponding `tokenBridge`. Here we create a VAA that introduces a Solana test token to Wormchain's `tokenBridge`.

```js
  const emitterInfo = {
    emitterAddress: emitterAddress.toUniversalAddress(),
    emitterChain: 'Solana',
  };

  const payloadInfo = {
    tokenAddress: tokenAddress.toUniversalAddress(),
    tokenChain: 'Solana',
    decimals: 6,
    symbol: 'SOLT',
    name: 'Solana Test Token',
  };

  const attestMetaVaa = createAttestMetaVAA(emitterInfo, payloadInfo, true);
```

Notice;
* `emitterAddress` is the UniversalAddress of the `tokenBridge` contract in Solana end

This VAA is submitted to the `tokenBridge` wasm contract on Wormchain.

### Solana -> Osmosis
Here we fund our Osmosis account with the test token coming from Solana. 

```js
  /**
   * @type {import('./vaaHelpers.js').EmitterInfo}
   */
  const emitterInfo = {
    emitterAddress,
    emitterChain: 'Solana',
  };

  const encoder = new TextEncoder();

  const osmosisReceiver = encoder.encode(
    'osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6',
  );
  const transferPayload = {
    gateway_transfer: {
      chain: 20, // Osmosis
      fee: '0', // Has to be string
      nonce: Math.floor(Math.random() * 1_000_000),
      recipient: Buffer.from(osmosisReceiver).toString('base64'),
    },
  };

  /**
   * @type {import('./vaaHelpers.js').TransferWithPayloadPayloadInfo}
   */
  const payloadInfo = {
    payloadId: 3,
    fee: 0,
    tokenAmount: 30000000,
    tokenAddress: tokenAddress.toUniversalAddress(),
    tokenChain: 'Solana',
    toAddress: ibcTranslatorAddress.toUniversalAddress(),
    toChain: 'Wormchain',
    from: emitterAddress.toUniversalAddress(), // only a valid Solana address is enough
    payload: encoder.encode(JSON.stringify(transferPayload)),
  };
  const vaa = createTransferWithPayloadVAA(emitterInfo, payloadInfo, true);
```

This is a little bit more complex one. Let's break it down;
* Notice that the message is emitted from `tokenBridge` contract on Solana
* Assets are sent to `ibcTranslator` contract which then will route them to the end location
* `payloadId: 3` indicates this is a transfer that contains a payload in it
* We talked about nested `payload` objects before. Here we see it. For the inner payload;
  * This inner payload is used by `ibcTranslator` contract to route incoming assets to their destination
  * `gateway_transfer` means the routed transfer (Wormchain -> Osmosis) does not contain any arbitrary payload
  * `recipient` is NOT a UniversalAddress, base64 encoded Osmosis address instead

**Notes on `Transfer` and `TransferWithPayload` terminology**
`Transfer` and `TransferWithPayload` are special keywords that indicate whether the transfer is controlled by a contract that does something with the received assets (aggregator etc.) or an external user. According to this terminology Wormchain's `tokenBridge` interpret the above VAA as a `TransferWithPayload` operation because `ibcTranslator` is the `to` address and the outer `payload` has another `payload` in it. The inner `payload` has two options:
* `gateway_transfer`
* `gateway_transfer_with_payload`

Names are self explanatory. Here's an example `gateway_transfer_with_payload`:

```js
gateway_transfer_with_payload: {
      chain: 1,
      nonce: 6620,
      contract: 'xpobGmXdM2vx32p3r7UB/CXbf8CTjLCFlanvRzJly08=',
      payload: 'eyJmb28iOiJiYXIifQ=='
    }
```

Transfers that contain payload are considered as contract controlled transfer by convention of Wormhole. Hence the `contract` field. And the `payload` you see above is the controlling contract's instructions (whatever they may be). `contract` and `payload` fields are base64 encoded. Here's what you'll see if you decode them:

```js
> Buffer.from('eyJmb28iOiJiYXIifQ==', 'base64').toString()
'{"foo":"bar"}'

> Buffer.from('xpobGmXdM2vx32p3r7UB/CXbf8CTjLCFlanvRzJly08=', 'base64').toStrin('hex')
'c69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f'
```


**Submitting The VAA**
This VAA has to be submitted to two different contracts; `globalAccountant` and `ibcTranslator`. `globalAccountant` updates its records according to the money sent and `ibcTranslator` actually unwraps the transfer and routes the tokens.