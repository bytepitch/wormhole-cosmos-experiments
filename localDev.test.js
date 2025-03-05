import test from 'ava';
import { Wormhole } from '@wormhole-foundation/sdk';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';

import {
  createAttestMetaVAA,
  createSetMwVAA,
  createUpdateChannelVAA,
  createTransferWithPayloadVAA,
} from './vaaHelpers.js';
import {
  createSigner,
  sendGatewayGovTx,
  sendTbSubmitVaaTx,
  sendUpdateChannelInfoTx,
  sendGaSubmitVaaTx,
} from './txHelpers.js';

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
  govEmitterAddress: Wormhole.parseAddress(
    'Solana',
    '0000000000000000000000000000000000000000000000000000000000000004',
  ),
  ibcTranslatorAddress: Wormhole.parseAddress(
    'Wormchain',
    'wormhole1wn625s4jcmvk0szpl85rj5azkfc6suyvf75q6vrddscjdphtve8sca0pvl',
  ),
  guardianMnemonic:
    'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius',
  wormchainFeePayer: 'wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq',
  wormchainRpc: 'http://localhost:26659',
};

test.before(async (t) => {
  const { guardianMnemonic, wormchainRpc } = config;
  const client = await createSigner(guardianMnemonic, wormchainRpc);
  t.context = {
    client,
  };
});

test('attest', async (t) => {
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
  const txHash = await sendTbSubmitVaaTx(client, attestMetaVaa);
  console.log('HASH', txHash);

  t.pass();
});

/**
 * submit this vaa to tokenBridge and globalAccountant
 */
test('send-to-osmo', async (t) => {
  // const testTokenAddr = Wormhole.parseAddress(
  //     'Solana',
  //     '2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ',
  //   ),
  //   receiver = Wormhole.parseAddress('Wormchain', 'ibc-translator'),
  //   base64EncodedReceiver = new TextEncoder().encode(
  //     'osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6',
  //   ),
  //   myPayloadRaw = {
  //     gateway_transfer: {
  //       chain: 20,
  //       fee: '0',
  //       nonce: 77993,
  //       recipient: Buffer.from(base64EncodedReceiver).toString('base64'),
  //     },
  //   },
  //   encoder = new TextEncoder(),
  //   payloadBytes = encoder.encode(JSON.stringify(myPayloadRaw));
  // const tokenBridgeVaa = createVAA('TokenBridge:TransferWithPayload', {
  //   guardianSet: 0,
  //   timestamp: 1,
  //   nonce: 421,
  //   emitterChain: 'Solana',
  //   emitterAddress: emitterAddress.toUniversalAddress(),
  //   sequence: 85431157n,
  //   consistencyLevel: 0,
  //   signatures: [],
  //   payload: {
  //     payloadId: 3,
  //     fee: 0n,
  //     token: {
  //       amount: 100000000n,
  //       address: testTokenAddr.toUniversalAddress(),
  //       chain: 'Solana',
  //     },
  //     to: {
  //       chain: 'Wormchain',
  //       address: receiver.toUniversalAddress(),
  //     },
  //     from: emitterAddress.toUniversalAddress(),
  //     payload: payloadBytes,
  //   },
  // });

  const { client } = t.context;
  const { emitterAddress, tokenAddress, ibcTranslatorAddress } = config;

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
      fee: 0,
      nonce: Math.floor(Math.random() * 1_000_000),
      recipient: Buffer.from(osmosisReceiver).toString('base64'),
    },
  };

  /**
   * @type {import('./vaaHelpers.js').TransferWithPayloadPayloadInfo}
   */
  const payloadInfo = {
    fee: 0,
    tokenAmount: 10000000,
    tokenAddress: tokenAddress.toUniversalAddress(),
    tokenChain: 'Solana',
    toAddress: ibcTranslatorAddress.toUniversalAddress(),
    toChain: 'Wormchain',
    from: emitterAddress.toUniversalAddress(), // only a valid Solana address is enough
    payload: encoder.encode(JSON.stringify(transferPayload)),
  };
  const vaa = createTransferWithPayloadVAA(emitterInfo, payloadInfo, true);
  console.log(vaa);

  const tx = await sendTbSubmitVaaTx(client, vaa);
  console.log('TX:', tx);
  t.pass();
});

/**
 * submit this vaa to ibcTranslator
 */
test('update channel info', async (t) => {
  const { client } = t.context;
  const { govEmitterAddress } = config;

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
  const tx = await sendUpdateChannelInfoTx(client, vaa);
  console.log('TX:', tx);
  t.pass();
});

/**
 * submit this vaa to wormchaind wormhole module
 */
test('mw-set-vaa', async (t) => {
  const { ibcTranslatorAddress, govEmitterAddress } = config;

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
  console.log(vaa);

  const tx = await sendGatewayGovTx(vaa);
  console.log('TX:', tx);

  t.pass();
});

/**
 * submit this vaa to globalAccountant
 */
test.todo(
  'introduce tokenBridge as Wormchain emitter address in globalAccountant',
);

test('introduce transfer vaa to globalAccountant', async (t) => {
  const { client } = t.context;
  const { emitterAddress, tokenAddress, ibcTranslatorAddress } = config;

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
      fee: 0,
      nonce: Math.floor(Math.random() * 1_000_000),
      recipient: Buffer.from(osmosisReceiver).toString('base64'),
    },
  };

  /**
   * @type {import('./vaaHelpers.js').TransferWithPayloadPayloadInfo}
   */
  const payloadInfo = {
    fee: 0,
    tokenAmount: 10000000,
    tokenAddress: tokenAddress.toUniversalAddress(),
    tokenChain: 'Solana',
    toAddress: ibcTranslatorAddress.toUniversalAddress(),
    toChain: 'Wormchain',
    from: emitterAddress.toUniversalAddress(), // only a valid Solana address is enough
    payload: encoder.encode(JSON.stringify(transferPayload)),
  };
  const vaa = createTransferWithPayloadVAA(emitterInfo, payloadInfo, true);
  console.log(vaa);

  const tx = await sendGaSubmitVaaTx(client, vaa);
  console.log('TX:', tx);

  const rpc = await CosmWasmClient.connect(config.wormchainRpc);

  const { accounts } = await rpc.queryContractSmart(
    'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465',
    { all_accounts: {} },
  );
  console.log('accounts:', accounts);

  t.pass();
});
