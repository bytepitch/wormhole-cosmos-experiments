import test from 'ava';
import {
  GatewayTransfer,
  Signature,
  SignatureUtils,
  Wormhole,
  amount,
  keccak256,
  wormhole,
} from '@wormhole-foundation/sdk';
import { getCosmwasmSigner } from '@wormhole-foundation/sdk-cosmwasm';
import { getSolanaSignAndSendSigner } from '@wormhole-foundation/sdk-solana';
import cosmwasm from '@wormhole-foundation/sdk/cosmwasm';
import sol from '@wormhole-foundation/sdk/solana';
import { configDotenv } from 'dotenv';

const config = {
  osmosis: {
    faucet: 'https://faucet.testnet.osmosis.zone/',
    userAddr: 'osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6',
    ibcChannelOverride: [{ chain: 'Wormchain', channel: 'channel-9867' }],
  },
  solana: {
    faucet: 'https://faucet.solana.com/',
    userAddr: 'B2VfpvVnkCupEf2AYXdDuNun8JpoeV36pFWgVmwv3qsR',
  },
};

const overrideIbcChannelInfo = async (ibcChain, overrides) => {
  const rawInfo = await ibcChain.getIbcBridge(),
    channelToChain = new Map(),
    chainToChannel = new Map();
  rawInfo.chainToChannel = chainToChannel;
  rawInfo.channelToChain = channelToChain;

  for (const { chain, channel } of overrides) {
    chainToChannel.set(chain, channel);
    channelToChain.set(channel, chain);
  }
};

const addSignature = (guardianKey, vaa) => {
  const signature = SignatureUtils.sign(guardianKey, keccak256(vaa.hash)),
    s = new Signature(signature.r, signature.s, signature.recovery);

  vaa.signatures.push({ guardianIndex: 0, signature: s });
};

test('config', async t => {
  const wh = await wormhole('Mainnet', [cosmwasm, sol]),
    osmosis = wh.getChain('Wormchain'),
    solana = wh.getChain('Solana');

  console.log('HELP', osmosis.config.contracts);

  // Const route = await GatewayTransfer.from(
  //     Wh,
  //     {
  //       Chain: solana.chain,
  //       Txid: "4FdzDXXXzBVJBYtboevmL4JW1kwLMjNPMhHRTsSLqs3cFLWqau3CMSdnHk5SUB3AjQM5xUHNUGMng7s6aWBBHuab",
  //     },
  //     600_000,);

  // Console.log(route.ibcTransfers)
  // Console.log(route.ibcTransfers[0].data)
  // Console.log(route.ibcTransfers[1].data)

  // Const rawInfo = await osmosis.getIbcBridge();

  // Await overrideIbcChannelInfo(osmosis, [{ chain: 'Wormchain', channel: 'channel-9867'}, { chain: 'Agoric', channel: 'channel-1'}]);
  // Const overriddenInfo = await osmosis.getIbcBridge();

  // Console.log('OSMO', overriddenInfo)

  // T.deepEqual(overriddenInfo, rawInfo)
  t.pass();
});

test('to Solana', async t => {
  const wh = await wormhole('Testnet', [cosmwasm, sol]);
  osmosis = wh.getChain('Osmosis');
  solana = wh.getChain('Solana');

  configDotenv();
  const osmosisSigner = await getCosmwasmSigner(
      await osmosis.getRpc(),
      process.env.COSMOS_MNEMONIC,
    ),
    solSigner = await (
      await sol()
    ).getSigner(await solana.getRpc(), process.env.SOL_PRIVATE_KEY);

  t.is(osmosisSigner.address(), config.osmosis.userAddr);
  t.is(solSigner.address(), config.solana.userAddr);

  const cosmosTokenAddress = Wormhole.parseAddress(
    'Wormchain',
    'factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/5Mt8WMcNw6541TKyijWWH8HSBZDkKteBQhP3oDNTnR4s',
  );
  (token = { chain: osmosis.chain, address: cosmosTokenAddress }),
    (xfer = await GatewayTransfer.from(wh, {
      token,
      amount: 100000n,
      from: {
        chain: osmosis.chain,
        signer: osmosisSigner,
        address: Wormhole.chainAddress(osmosis.chain, osmosisSigner.address())
          .address,
      },
      to: {
        chain: solana.chain,
        signer: solSigner,
        address: Wormhole.chainAddress(solana.chain, solSigner.address())
          .address,
      },
    }));

  console.log(xfer);

  console.log('Created GatewayTransfer: ', xfer.transfer);
  const srcTxIds = await xfer.initiateTransfer(osmosisSigner);
  console.log('Started transfer on source chain', srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log('Got attests', attests);

  // Since we're leaving cosmos, this is required to complete the transfer
  const dstTxIds = await xfer.completeTransfer(solSigner);
  console.log('Completed transfer on destination chain', dstTxIds);
  // EXAMPLE_GATEWAY_OUTBOUND
});

test('to Solana, relayer pays redeeming', async t => {
  const wh = await wormhole('Testnet', [cosmwasm, sol]),
    osmosis = wh.getChain('Osmosis'),
    solana = wh.getChain('Solana');

  configDotenv();
  const osmosisSigner = await getCosmwasmSigner(
      await osmosis.getRpc(),
      process.env.COSMOS_MNEMONIC,
    ),
    solSigner = await (
      await sol()
    ).getSigner(await solana.getRpc(), process.env.SOL_PRIVATE_KEY),
    relayerSigner = await (
      await sol()
    ).getSigner(await solana.getRpc(), process.env.SOL_RELAYER_PRIVATE_KEY);

  await overrideIbcChannelInfo(osmosis, [
    { chain: 'Wormchain', channel: 'channel-9867' },
  ]);
  const dummy = {
    ...wh,
    getChain: wh.getChain,
    getPlatform: wh.getPlatform,
  };
  wh.getChain = function (chainName) {
    if (chainName === osmosis.chain) {
      return osmosis;
    }
    return dummy.getChain(chainName);
  };

  t.is(osmosisSigner.address(), config.osmosis.userAddr);
  t.is(solSigner.address(), config.solana.userAddr);

  const cosmosTokenAddress = Wormhole.parseAddress(
      'Wormchain',
      'factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/5Mt8WMcNw6541TKyijWWH8HSBZDkKteBQhP3oDNTnR4s',
    ),
    token = { chain: osmosis.chain, address: cosmosTokenAddress },
    xfer = await GatewayTransfer.from(wh, {
      token,
      amount: 100000n,
      from: {
        chain: osmosis.chain,
        signer: osmosisSigner,
        address: Wormhole.chainAddress(osmosis.chain, osmosisSigner.address())
          .address,
      },
      to: {
        chain: solana.chain,
        signer: solSigner,
        address: Wormhole.chainAddress(solana.chain, solSigner.address())
          .address,
      },
    });

  console.log(xfer);

  console.log('Created GatewayTransfer: ', xfer.transfer);
  const srcTxIds = await xfer.initiateTransfer(osmosisSigner);
  console.log('Started transfer on source chain', srcTxIds);

  // Const attests = await xfer.fetchAttestation(600_000);
  // Console.log("Got attests", attests);

  // // Since we're leaving cosmos, this is required to complete the transfer
  // Const dstTxIds = await xfer.completeTransfer(relayerSigner);
  // Console.log("Completed transfer on destination chain", dstTxIds);
  // EXAMPLE_GATEWAY_OUTBOUND
});

test('to Cosmos', async t => {
  const wh = await wormhole('Testnet', [cosmwasm, sol]);
  const osmosis = wh.getChain('Osmosis');
  const solana = wh.getChain('Solana');

  // Console.log({solana: solana.config.tokenMap})

  configDotenv();
  const osmosisSigner = await getCosmwasmSigner(
    await osmosis.getRpc(),
    process.env.COSMOS_MNEMONIC,
  );
  const solSigner = await getSolanaSignAndSendSigner(
    await solana.getRpc(),
    process.env.SOL_PRIVATE_KEY,
  );

  t.is(osmosisSigner.address(), config.osmosis.userAddr);
  t.is(solSigner.address(), config.solana.userAddr);

  // We'll use the native token on the source chain
  const token = Wormhole.tokenId(solana.chain, 'native');
  const amt = amount.units(
    amount.parse('0.01', solana.config.nativeTokenDecimals),
  );
  const osmoSignStuff = {
    chain: osmosis.chain,
    signer: osmosisSigner,
    address: Wormhole.chainAddress(osmosis.chain, osmosisSigner.address()),
  };
  const solanaSignStuff = {
    chain: solana.chain,
    signer: solSigner,
    address: Wormhole.chainAddress(solana.chain, solSigner.address()),
  };
  const xfer = await GatewayTransfer.from(wh, {
    token,
    amount: amt,
    from: solanaSignStuff.address,
    to: osmoSignStuff.address,
  });

  console.log('XFER', xfer);

  const srcTxIds = await xfer.initiateTransfer(solanaSignStuff.signer);
  console.log('Started transfer on source chain', srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log('Got Attestations', attests);
});

test.skip('resume tx', async t => {
  const wh = await wormhole('Testnet', [cosmwasm, sol]),
    osmosis = wh.getChain('Osmosis'),
    solana = wh.getChain('Solana');

  configDotenv();
  const osmosisSigner = await getCosmwasmSigner(
    await osmosis.getRpc(),
    process.env.COSMOS_MNEMONIC_M,
  );
  const solSigner = await (
    await sol()
  ).getSigner(await solana.getRpc(), process.env.SOL_PRIVATE_KEY_M);

  const relayerSigner = await (
    await sol()
  ).getSigner(await solana.getRpc(), process.env.SOL_RELAYER_PRIVATE_KEY, {
    debug: true,
  });
  const xfer = await GatewayTransfer.from(
    wh,
    {
      chain: 'Osmosis',
      txid: '17A53DE03FDD42E9ABEE4DCBF27021B4E721A87FDD7B73BD36EF8254682F3322',
    },
    600_000,
  );

  console.log('xfer');

  // Console.log("Created GatewayTransfer: ", xfer.transfer);
  // Const srcTxIds = await xfer.initiateTransfer(osmosisSigner);
  // Console.log("Started transfer on source chain", srcTxIds);

  // Const attests = await xfer.fetchAttestation(600_000);
  // Console.log("Got attests", attests);

  // Since we're leaving cosmos, this is required to complete the transfer
  // Const dstTxIds = await xfer.completeTransfer(relayerSigner);
  // Console.log("Completed transfer on destination chain", dstTxIds);

  t.pass();
});
