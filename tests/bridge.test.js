import test from "ava";
import { Wormhole } from "@wormhole-foundation/sdk";
import { startbridge } from "../helpers/bridge.js";

test.skip("Bridge Osmosis -> Solana", async (t) => {
  const transfer = {
    sendChain: "Solana",
    rcvChain: "Osmosis",
    tokenId: Wormhole.tokenId("Solana", "native"),
    amount: "0.01",
    automatic: false,
    execute: true,
  };

  try {
    const result = await startbridge(transfer);
    console.log(result);
    t.truthy(result);
  } catch (error) {
    t.fail(`startbridge failed with error: ${error.message}`);
  }
});

test("Bridge Solana -> Osmosis", async (t) => {
  const transfer = {
    sendChain: "Solana",
    rcvChain: "Osmosis",
    tokenId: Wormhole.tokenId("Solana", "native"),
    amount: "0.01",
    automatic: false,
    execute: true,
  };

  try {
    const result = await startbridge(transfer);
    console.log(result);
    t.truthy(result);
  } catch (error) {
    t.fail(`startbridge failed with error: ${error.message}`);
  }
});
