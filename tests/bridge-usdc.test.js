import test from "ava";
import { configDotenv } from "dotenv";
import {
  wormhole,
  Wormhole,
  GatewayTransfer,
  amount,
} from "@wormhole-foundation/sdk";
import { getCosmwasmSigner } from "@wormhole-foundation/sdk-cosmwasm";
import { getSolanaSignAndSendSigner } from "@wormhole-foundation/sdk-solana";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import sol from "@wormhole-foundation/sdk/solana";
import { circle } from "@wormhole-foundation/sdk-base";

configDotenv();
const config = {
  osmosis: {
    userAddr: process.env["COSMOS_ADDRESS"],
    mnemonic: process.env["COSMOS_MNEMONIC"],
  },
  solana: {
    userAddr: process.env["SOLANA__ADDRESS"],
    privateKey: process.env["SOLANA_PRIVATE_KEY"],
  },
};

test("bridge USDC: SOLANA -> OSMOSIS", async (t) => {
  const wh = await wormhole("Testnet", [cosmwasm, sol]);

  const osmosis = wh.getChain("Osmosis");
  const solana = wh.getChain("Solana");

  const osmosisSigner = await getCosmwasmSigner(
    await osmosis.getRpc(),
    config.osmosis.mnemonic
  );
  const solanaSigner = await getSolanaSignAndSendSigner(
    await solana.getRpc(),
    config.solana.privateKey
  );

  t.is(osmosisSigner.address(), config.osmosis.userAddr);
  t.is(solanaSigner.address(), config.solana.userAddr);

  const usdcAddress = Wormhole.parseAddress(
    "Solana",
    circle.usdcContract.get(solana.network, solana.chain)
  );
  console.log(usdcAddress);

  const token = Wormhole.tokenId(solana.chain, usdcAddress);
  const amt = amount.units(
    amount.parse("0.001", solana.config.nativeTokenDecimals)
  );
  let fakeIt = false;
  // Transfer native token from source chain, through gateway, to a cosmos chain
  let route1 = fakeIt
    ? await GatewayTransfer.from(
        wh,
        {
          chain: solana.chain,
          txid: "5y2BnJ1Nwqe4m6KTSrry5Ni88xqVrqo4jdbuNwAPDuXEonQRVLbALf7abViwucKKr8U8cDfJtDmqnuRAAC6i6wtb",
        },
        600_000
      )
    : await transferIntoCosmos(wh, token, amt, osmosisSigner, solanaSigner);
  console.log("Route 1 (External => Cosmos)", route1);

  console.log(xfer);
});

async function transferIntoCosmos(wh, token, amount, src, dst) {
  const xfer = await GatewayTransfer.from(wh, {
    token: token,
    amount: amount,
    from: src.address,
    to: dst.address,
  });
  console.log("Created GatewayTransfer: ", xfer.transfer);

  const srcTxIds = await xfer.initiateTransfer(src.signer);
  console.log("Started transfer on source chain", srcTxIds);

  const attests = await xfer.fetchAttestation(600_000);
  console.log("Got Attestations", attests);
  // EXAMPLE_GATEWAY_INBOUND

  return xfer;
}
