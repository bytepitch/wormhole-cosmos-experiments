import test from 'ava';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { serialize, Wormhole } from '@wormhole-foundation/sdk';

import {
  createAttestMetaVAA,
  createSetMwVAA,
  createUpdateChannelVAA,
  createTransferWithPayloadVAA,
  createRegisterWormchainToAccountantVAA,
} from './vaaHelpers.js';
import {
  createSigner,
  sendCompleteTransferAndConvertTx,
  sendGatewayGovTx,
  sendGaSubmitVaasTx,
  sendTbSubmitVaaTx,
  sendUpdateChannelInfoTx,
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
  tokenBridgeAddress: Wormhole.parseAddress(
    'Wormchain',
    'wormhole1eyfccmjm6732k7wp4p6gdjwhxjwsvje44j0hfx8nkgrm8fs7vqfssvpdkx',
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

test.before(async t => {
  const { guardianMnemonic, wormchainRpc } = config;
  const client = await createSigner(guardianMnemonic, wormchainRpc);
  t.context = {
    client,
  };
});

// ////////////////// Bootstrap Environment //////////////////

test('update-channel-info', async t => {
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

test('mw-set-vaa', async t => {
  const { client } = t.context;
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
  t.log(Buffer.from(serialize(vaa)).toString('hex'));

  const tx = await sendGatewayGovTx(client, vaa);
  console.log('TX:', tx);

  t.pass();
});

test('register-tb-to-accountant', async t => {
  const { client } = t.context;
  const { govEmitterAddress, tokenBridgeAddress } = config;

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
  t.log(Buffer.from(serialize(vaa)).toString('hex'));

  const tx = await sendGaSubmitVaasTx(client, vaa);
  console.log('TX:', tx);

  t.pass();
});

test('attest', async t => {
  const { client } = t.context;
  const { emitterAddress, tokenAddress } = config;

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
  console.log(attestMetaVaa);

  const txHash = await sendTbSubmitVaaTx(client, attestMetaVaa);
  console.log('HASH', txHash);

  t.pass();
});

// ////////////////// Use Case //////////////////

test('send-to-osmo', async t => {
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
  t.log(Buffer.from(serialize(vaa)).toString('hex'));

  const tx = await sendCompleteTransferAndConvertTx(client, vaa);
  console.log('TX:', tx);
  t.pass();
});

test('introduce-transfer-vaa-to-globalAccountant', async t => {
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
    tokenAmount: 30000000,
    tokenAddress: tokenAddress.toUniversalAddress(),
    tokenChain: 'Solana',
    toAddress: ibcTranslatorAddress.toUniversalAddress(),
    toChain: 'Wormchain',
    from: emitterAddress.toUniversalAddress(), // only a valid Solana address is enough
    payload: encoder.encode(JSON.stringify(transferPayload)),
  };
  const vaa = createTransferWithPayloadVAA(emitterInfo, payloadInfo, true);
  console.log(vaa);

  const tx = await sendGaSubmitVaasTx(client, vaa);
  console.log('TX:', tx);

  const rpc = await CosmWasmClient.connect(config.wormchainRpc);

  const { accounts } = await rpc.queryContractSmart(
    'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465',
    { all_accounts: {} },
  );
  console.log('accounts:', accounts);

  t.pass();
});

test.todo('send from osmo');

test.todo('verify-vaa');
