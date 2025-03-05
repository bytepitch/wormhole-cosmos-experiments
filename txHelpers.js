import { buildExecuteMsg } from '@wormhole-foundation/sdk-cosmwasm';
import { serialize } from '@wormhole-foundation/sdk';
import { SigningStargateClient } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MsgExecuteGatewayGovernanceVaa } from '@wormhole-foundation/wormchain-sdk/lib/modules/wormhole_foundation.wormchain.wormhole/types/wormhole/tx.js';
import { getRegistry } from './registryHelpers.js';

const config = {
  network: 'Devnet',
  chain: 'Wormchain',
  prefix: 'wormhole',
  guardianMnemonic:
    'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius',
  wormchainFeePayer: 'wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq',
  addresses: {
    tokenBridge:
      'wormhole1eyfccmjm6732k7wp4p6gdjwhxjwsvje44j0hfx8nkgrm8fs7vqfssvpdkx',
    ibcTranslator:
      'wormhole1wn625s4jcmvk0szpl85rj5azkfc6suyvf75q6vrddscjdphtve8sca0pvl',
    globalAccountant:
      'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465',
  },
};

const MSG_EXECUTE_GATEWAY_GOV =
  '/wormhole_foundation.wormchain.wormhole.MsgExecuteGatewayGovernanceVaa';

const GAS_OPTS = {
  amount: [{ amount: '0', denom: 'uworm' }],
  gas: '10000000',
};

export const createSigner = async (mnemonic, tendermintAddress) => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: config.prefix,
  });

  const registry = getRegistry();

  const client = await SigningStargateClient.connectWithSigner(
    tendermintAddress,
    wallet,
    {
      registry,
    },
  );

  return client;
};

const buildGatewayGovMessage = (vaa) => {
  const govMsg = {
    typeUrl: MSG_EXECUTE_GATEWAY_GOV,
    value: MsgExecuteGatewayGovernanceVaa.fromPartial({
      signer: config.wormchainFeePayer,
      vaa: serialize(vaa),
    }),
  };

  return govMsg;
};

/**
 *
 * @param {SigningStargateClient} client
 * @param {{
 *   msgRecord: Record<string, string>;
 *   wasmContract: string;
 *   feePayer: string;
 * }} wasmOpts
 * @returns
 */
export const sendWasmTx = async (
  client,
  { msgRecord, wasmContract, feePayer },
) => {
  const msg = buildExecuteMsg(feePayer, wasmContract, msgRecord);
  const tx = await client.signAndBroadcast(feePayer, [msg], GAS_OPTS);

  return tx;
};

export const sendTbSubmitVaaTx = async (client, vaa) => {
  const msgRecord = {
    submit_vaa: { data: Buffer.from(serialize(vaa)).toString('base64') },
  };
  return sendWasmTx(client, {
    msgRecord,
    wasmContract: config.addresses.tokenBridge,
    feePayer: config.wormchainFeePayer,
  });
};

export const sendGatewayGovTx = async (client, vaa) => {
  const govMsg = buildGatewayGovMessage(vaa);
  const executeRes = await client.signAndBroadcast(
    config.wormchainFeePayer,
    [govMsg],
    GAS_OPTS,
  );

  return executeRes;
};

export const sendUpdateChannelInfoTx = async (client, vaa) => {
  const msgRecord = {
    submit_update_chain_to_channel_map: {
      vaa: Buffer.from(serialize(vaa)).toString('base64'),
    },
  };

  return sendWasmTx(client, {
    msgRecord,
    wasmContract: config.addresses.ibcTranslator,
    feePayer: config.wormchainFeePayer,
  });
};

export const sendCompleteTransferAndConvertTx = (client, vaa) => {
  const msgRecord = {
    complete_transfer_and_convert: {
      vaa: Buffer.from(serialize(vaa)).toString('base64'),
    },
  };
  return sendWasmTx(client, {
    msgRecord,
    wasmContract: config.addresses.ibcTranslator,
    feePayer: config.wormchainFeePayer,
  });
};

export const sendGaSubmitVaaTx = async (client, vaa) => {
  const msgRecord = {
    submit_vaas: { vaas: [Buffer.from(serialize(vaa)).toString('base64')] },
  };
  return sendWasmTx(client, {
    msgRecord,
    wasmContract: config.addresses.globalAccountant,
    feePayer: config.wormchainFeePayer,
  });
};
