import {
  buildExecuteMsg,
  CosmwasmUnsignedTransaction,
} from '@wormhole-foundation/sdk-cosmwasm';

import { serialize } from '@wormhole-foundation/sdk';

import { SigningStargateClient } from '@cosmjs/stargate';

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import * as coreModule from '@wormhole-foundation/wormchain-sdk/lib/modules/wormhole_foundation.wormchain.wormhole/types/wormhole/tx.js';
import * as wasm from '@wormhole-foundation/wormchain-sdk/lib/modules/cosmwasm.wasm.v1/index.js';

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
  },
};

const GAS_OPTS = {
  amount: [{ amount: '0', denom: 'uworm' }],
  gas: '10000000',
};

export const createSigner = async (mnemonic, tendermintAddress) => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: config.prefix,
  });

  const client = await SigningStargateClient.connectWithSigner(
    tendermintAddress,
    wallet,
    {
      registry: wasm.registry,
    },
  );

  return client;
};

const createUnsignedTx = (txReq, description, parallelizable = false) => {
  return new CosmwasmUnsignedTransaction(
    txReq,
    config.network,
    config.chain,
    description,
    parallelizable,
  );
};

const buildGatewayGovMessage = (vaa) => {
  coreModule.MsgExecuteGatewayGovernanceVaa();
};

export const sendAttestMetaTx = async (client, vaa) => {
  const attestMsg = buildExecuteMsg(
    config.wormchainFeePayer,
    config.addresses.tokenBridge,
    {
      submit_vaa: { data: Buffer.from(serialize(vaa)).toString('base64') },
    },
  );

  const executeRes = await client.signAndBroadcast(
    config.wormchainFeePayer,
    [attestMsg],
    GAS_OPTS,
  );

  return executeRes;
};
