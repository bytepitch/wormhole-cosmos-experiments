import test from 'ava';
import {
  Wormhole,
  createVAA,
  deserialize,
  serialize,
} from '@wormhole-foundation/sdk';

import { serialiseVAA, sign } from '@certusone/wormhole-sdk';
import { createAttestMetaVAA, addSignature } from './vaaHelpers.js';
import { createSigner, sendAttestMetaTx } from './txHelpers.js';

const config = {
  emitterAddress: Wormhole.parseAddress(
    'Solana',
    'ENG1wQ7CQKH8ibAJ1hSLmJgL9Ucg6DRDbj752ZAfidLA',
  ),
  // Test token address on Solana
  tokenAddress: Wormhole.parseAddress(
    'Solana',
    '2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ',
  ),
  guardianMnemonic:
    'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius',
  wormchainFeePayer: 'wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq',
};

test.only('attest', async (t) => {
  const emitterInfo = {
    emitterAddress: config.emitterAddress.toUniversalAddress(),
    emitterChain: 'Solana',
  };

  const payloadInfo = {
    tokenAddress: config.tokenAddress.toUniversalAddress(),
    tokenChain: 'Solana',
    decimals: 6,
    symbol: 'SOLT',
    name: 'Solana Test Token',
  };

  const attestMetaVaa = createAttestMetaVAA(emitterInfo, payloadInfo, true);
  console.log(attestMetaVaa);

  const client = await createSigner(
    config.guardianMnemonic,
    'http://localhost:26659',
  );
  const txHash = await sendAttestMetaTx(client, attestMetaVaa);
  console.log('HASH', txHash);

  t.pass();
});

/**
 * submit this vaa to tokenBridge and globalAccountant
 */
test('createVaa', async (t) => {
  const testTokenAddr = Wormhole.parseAddress(
      'Solana',
      '2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ',
    ),
    emitterAddress = Wormhole.parseAddress(
      'Solana',
      'ENG1wQ7CQKH8ibAJ1hSLmJgL9Ucg6DRDbj752ZAfidLA',
    ),
    receiver = Wormhole.parseAddress('Wormchain', 'ibc-translator'),
    base64EncodedReceiver = new TextEncoder().encode(
      'osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6',
    ),
    myPayloadRaw = {
      gateway_transfer: {
        chain: 20,
        fee: '0',
        nonce: 77993,
        recipient: Buffer.from(base64EncodedReceiver).toString('base64'),
      },
    },
    encoder = new TextEncoder(),
    payloadBytes = encoder.encode(JSON.stringify(myPayloadRaw)),
    tokenBridgeVaa = createVAA('TokenBridge:TransferWithPayload', {
      guardianSet: 0,
      timestamp: 1,
      nonce: 421,
      emitterChain: 'Solana',
      emitterAddress: emitterAddress.toUniversalAddress(),
      sequence: 85431157n,
      consistencyLevel: 0,
      signatures: [],
      payload: {
        payloadId: 3,
        fee: 0n,
        token: {
          amount: 100000000n,
          address: testTokenAddr.toUniversalAddress(),
          chain: 'Solana',
        },
        to: {
          chain: 'Wormchain',
          address: receiver.toUniversalAddress(),
        },
        from: emitterAddress.toUniversalAddress(),
        payload: payloadBytes,
      },
    });

  addSignature(
    'cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0',
    tokenBridgeVaa,
  );

  const tokenBridgeVaaBytes = serialize(tokenBridgeVaa);

  console.log(tokenBridgeVaaBytes);
  console.log(tokenBridgeVaa);
  console.log(Buffer.from(tokenBridgeVaaBytes).toString('hex'));

  t.pass();
});

/**
 * submit this vaa to ibcTranslator
 */
test('update channel info', async (t) => {
  const updateChannelVaa = {
    version: 1,
    guardianSetIndex: 0,
    signatures: [],
    timestamp: 0,
    nonce: 0,
    emitterChain: 1,
    emitterAddress:
      '0000000000000000000000000000000000000000000000000000000000000004',
    sequence: BigInt(Math.floor(Math.random() * 100000000)),
    consistencyLevel: 0,
    payload: {
      type: 'Other',
      hex:
        '000000000000000000000000000000000000004962635472616e736c61746f72' + // Module IbcTranslator
        '01' + // Action IbcReceiverActionUpdateChannelChain
        '0c20' + // Target chain id wormchain
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006368616e6e656c2d30' + // Channel-0
        '0014', // Chain id osmo-test-5 (20)
    },
  };
  updateChannelVaa.signatures = sign(
    ['cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0'],
    updateChannelVaa,
  );

  const serialized = serialiseVAA(updateChannelVaa);

  console.log(updateChannelVaa);
  console.log(serialized);
  console.log('BASE_64:', Buffer.from(serialized).toString('base64'));
  t.pass();
});

/**
 * submit this vaa to wormchaind wormhole module
 */
test('mw-set-vaa', async (t) => {
  const emitterAddress = Wormhole.parseAddress(
      'Solana',
      '0000000000000000000000000000000000000000000000000000000000000004',
    ),
    mwAddress = Wormhole.parseAddress(
      'Wormchain',
      'wormhole1wn625s4jcmvk0szpl85rj5azkfc6suyvf75q6vrddscjdphtve8sca0pvl',
    ),
    base = createVAA('GatewayGovernance:SetIbcComposabilityMwContract', {
      guardianSet: 0,
      nonce: 0,
      timestamp: 0,
      signatures: [],
      sequence: 0n,
      emitterChain: 'Solana',
      emitterAddress: emitterAddress.toUniversalAddress(),
      consistencyLevel: 0,
      payload: {
        // Protocol: 'GatewayGovernance',
        // Action: 'ScheduleUpgrade',
        chain: 'Wormchain',
        actionArgs: {
          contractAddress: mwAddress,
        },
      },
    }),
    serializedVaa = serialize(base),
    vaa = deserialize(
      'GatewayGovernance:SetIbcComposabilityMwContract',
      serializedVaa,
    );

  console.log(base);
  console.log(serializedVaa);
  console.log(vaa);
  console.log(Buffer.from(serializedVaa).toString('hex'));
  t.pass();
});

/**
 * submit this vaa to globalAccountant
 */
test.todo(
  'introduce tokenBridge as Wormchain emitter address in globalAccountant',
);
