import test from "ava";
import {
  GatewayTransfer,
  Signature,
  SignatureUtils,
  Wormhole,
  amount,
  createVAA,
  deserialize,
  keccak256,
  serialize,
  signSendWait,
  wormhole,
} from "@wormhole-foundation/sdk";
import { getCosmwasmSigner } from "@wormhole-foundation/sdk-cosmwasm";
import { getSolanaSignAndSendSigner } from "@wormhole-foundation/sdk-solana";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import sol from "@wormhole-foundation/sdk/solana";
import { configDotenv } from "dotenv";
import { createPayload3 } from "./generateVaa.js";

import { serialiseVAA, sign } from "@certusone/wormhole-sdk";

const config = {
  osmosis: {
    faucet: "https://faucet.testnet.osmosis.zone/",
    userAddr: "osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6",
    ibcChannelOverride: [{ chain: "Wormchain", channel: "channel-9867" }],
  },
  solana: {
    faucet: "https://faucet.solana.com/",
    userAddr: "B2VfpvVnkCupEf2AYXdDuNun8JpoeV36pFWgVmwv3qsR",
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

test("config", async (t) => {
  const wh = await wormhole("Mainnet", [cosmwasm, sol]),
    osmosis = wh.getChain("Wormchain"),
    solana = wh.getChain("Solana");

  console.log("HELP", osmosis.config.contracts);

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

test("to Solana", async (t) => {
  const wh = await wormhole("Testnet", [cosmwasm, sol]);
  osmosis = wh.getChain("Osmosis");
  solana = wh.getChain("Solana");

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
    "Wormchain",
    "factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/5Mt8WMcNw6541TKyijWWH8HSBZDkKteBQhP3oDNTnR4s",
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

  console.log("Created GatewayTransfer: ", xfer.transfer);
  const srcTxIds = await xfer.initiateTransfer(osmosisSigner);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got attests", attests);

  // Since we're leaving cosmos, this is required to complete the transfer
  const dstTxIds = await xfer.completeTransfer(solSigner);
  console.log("Completed transfer on destination chain", dstTxIds);
  // EXAMPLE_GATEWAY_OUTBOUND
});

test("to Solana, relayer pays redeeming", async (t) => {
  const wh = await wormhole("Testnet", [cosmwasm, sol]),
    osmosis = wh.getChain("Osmosis"),
    solana = wh.getChain("Solana");

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
    { chain: "Wormchain", channel: "channel-9867" },
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
      "Wormchain",
      "factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/5Mt8WMcNw6541TKyijWWH8HSBZDkKteBQhP3oDNTnR4s",
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

  console.log("Created GatewayTransfer: ", xfer.transfer);
  const srcTxIds = await xfer.initiateTransfer(osmosisSigner);
  console.log("Started transfer on source chain", srcTxIds);

  // Const attests = await xfer.fetchAttestation(600_000);
  // Console.log("Got attests", attests);

  // // Since we're leaving cosmos, this is required to complete the transfer
  // Const dstTxIds = await xfer.completeTransfer(relayerSigner);
  // Console.log("Completed transfer on destination chain", dstTxIds);
  // EXAMPLE_GATEWAY_OUTBOUND
});

test("to Cosmos", async (t) => {
  const wh = await wormhole("Testnet", [cosmwasm, sol]);
  const osmosis = wh.getChain("Osmosis");
  const solana = wh.getChain("Solana");

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
  const token = Wormhole.tokenId(solana.chain, "native");
  const amt = amount.units(
    amount.parse("0.01", solana.config.nativeTokenDecimals),
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

  console.log("XFER", xfer);

  const srcTxIds = await xfer.initiateTransfer(solanaSignStuff.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got Attestations", attests);
});

test.skip("resume tx", async (t) => {
  const wh = await wormhole("Testnet", [cosmwasm, sol]),
    osmosis = wh.getChain("Osmosis"),
    solana = wh.getChain("Solana");

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
      chain: "Osmosis",
      txid: "17A53DE03FDD42E9ABEE4DCBF27021B4E721A87FDD7B73BD36EF8254682F3322",
    },
    600_000,
  );

  console.log("xfer");

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

test("attest", async (t) => {
  const wh = await wormhole("Devnet", [cosmwasm], {
      chains: {
        Wormchain: {
          rpc: "http://localhost:26659/",
        },
      },
    }),
    attestVAA =
      "01000000000100aa317202bafeafba66ba87f225fe7a3a40b1ec64caedb0c48f8a1c1e64b66c4369a8d54a36ed2fbd1ce233f20c2c3b058506e61990f8422cbb218989918635a10100000001000000010001c69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f00000000051793740002165809739240a0ac03b98440fe8985548e3aa683cd0d4d9df5b5659669faa301000106534f4c540000000000000000000000000000000000000000000000000000000077534f4c54000000000000000000000000000000000000000000000000000000",
    testMnemonic =
      "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius",
    wormchain = wh.getChain("Wormchain"),
    client = await wormchain.getRpc();
  console.log(
    await client.queryClient.bank.balances(
      "wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq",
    ),
  );
  const wormchainSigner = await (
      await cosmwasm()
    ).getSigner(await wormchain.getRpc(), testMnemonic),
    tb = await wormchain.getTokenBridge(),
    tx = tb.submitAttestation(
      attestVAA,
      "wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq",
    );
  await signSendWait(wormchain, tx, wormchainSigner);
  t.pass();
});

/**
 * submit this vaa to tokenBridge and globalAccountant
 */
test("createVaa", async (t) => {
  const testTokenAddr = Wormhole.parseAddress(
      "Solana",
      "2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ",
    ),
    emitterAddress = Wormhole.parseAddress(
      "Solana",
      "ENG1wQ7CQKH8ibAJ1hSLmJgL9Ucg6DRDbj752ZAfidLA",
    ),
    receiver = Wormhole.parseAddress("Wormchain", "ibc-translator"),
    base64EncodedReceiver = new TextEncoder().encode(
      "osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6",
    ),
    myPayloadRaw = {
      gateway_transfer: {
        chain: 20,
        fee: "0",
        nonce: 77993,
        recipient: Buffer.from(base64EncodedReceiver).toString("base64"),
      },
    },
    encoder = new TextEncoder(),
    payloadBytes = encoder.encode(JSON.stringify(myPayloadRaw)),
    tokenBridgeVaa = createVAA("TokenBridge:TransferWithPayload", {
      guardianSet: 0,
      timestamp: 1,
      nonce: 421,
      emitterChain: "Solana",
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
          chain: "Solana",
        },
        to: {
          chain: "Wormchain",
          address: receiver.toUniversalAddress(),
        },
        from: emitterAddress.toUniversalAddress(),
        payload: payloadBytes,
      },
    });

  addSignature(
    "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0",
    tokenBridgeVaa,
  );

  const tokenBridgeVaaBytes = serialize(tokenBridgeVaa);

  console.log(tokenBridgeVaaBytes);
  console.log(tokenBridgeVaa);
  console.log(Buffer.from(tokenBridgeVaaBytes).toString("hex"));

  t.pass();
});

/**
 * submit this vaa to ibcTranslator
 */
test("update channel info", async (t) => {
  const updateChannelVaa = {
    version: 1,
    guardianSetIndex: 0,
    signatures: [],
    timestamp: 0,
    nonce: 0,
    emitterChain: 1,
    emitterAddress:
      "0000000000000000000000000000000000000000000000000000000000000004",
    sequence: BigInt(Math.floor(Math.random() * 100000000)),
    consistencyLevel: 0,
    payload: {
      type: "Other",
      hex:
        "000000000000000000000000000000000000004962635472616e736c61746f72" + // Module IbcTranslator
        "01" + // Action IbcReceiverActionUpdateChannelChain
        "0c20" + // Target chain id wormchain
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006368616e6e656c2d30" + // Channel-0
        "0014", // Chain id osmo-test-5 (20)
    },
  };
  updateChannelVaa.signatures = sign(
    ["cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"],
    updateChannelVaa,
  );

  const serialized = serialiseVAA(updateChannelVaa);

  console.log(updateChannelVaa);
  console.log(serialized);
  console.log("BASE_64:", Buffer.from(serialized).toString("base64"));
  t.pass();
});

/**
 * submit this vaa to wormchaind wormhole module
 */
test("mw-set-vaa", async (t) => {
  const emitterAddress = Wormhole.parseAddress(
      "Solana",
      "0000000000000000000000000000000000000000000000000000000000000004",
    ),
    mwAddress = Wormhole.parseAddress(
      "Wormchain",
      "wormhole1wn625s4jcmvk0szpl85rj5azkfc6suyvf75q6vrddscjdphtve8sca0pvl",
    ),
    base = createVAA("GatewayGovernance:SetIbcComposabilityMwContract", {
      guardianSet: 0,
      nonce: 0,
      timestamp: 0,
      signatures: [],
      sequence: 0n,
      emitterChain: "Solana",
      emitterAddress: emitterAddress.toUniversalAddress(),
      consistencyLevel: 0,
      payload: {
        // Protocol: 'GatewayGovernance',
        // Action: 'ScheduleUpgrade',
        chain: "Wormchain",
        actionArgs: {
          contractAddress: mwAddress,
        },
      },
    }),
    serializedVaa = serialize(base),
    vaa = deserialize(
      "GatewayGovernance:SetIbcComposabilityMwContract",
      serializedVaa,
    );

  console.log(base);
  console.log(serializedVaa);
  console.log(vaa);
  console.log(Buffer.from(serializedVaa).toString("hex"));
  t.pass();
});

/**
 * submit this vaa to globalAccountant
 */
test.todo(
  "introduce tokenBridge as Wormchain emitter address in globalAccountant",
);
