import { configDotenv } from "dotenv";
import {
  TokenTransfer,
  Wormhole,
  amount,
  isTokenId,
  routes,
  signSendWait,
  wormhole,
} from "@wormhole-foundation/sdk";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import cosmwasmSign from "@wormhole-foundation/sdk/platforms/cosmwasm";
import solana from "@wormhole-foundation/sdk/solana";
import solanasign from "@wormhole-foundation/sdk/platforms/solana";

configDotenv();
const config = {
  osmosis: {
    userAddr: process.env["COSMOS_ADDRESS_MAINNET"],
    mnemonic: process.env["COSMOS_MNEMONIC_MAINNET"],
  },
  solana: {
    userAddr: process.env["SOLANA_ADDRESS_MAINNET"],
    privateKey: process.env["SOLANA_PRIVATE_KEY_MAINNET"],
  },
};

async function initializeSigner(chain, rpc, privateKey) {
  let signer;

  switch (chain) {
    case "Solana":
      signer = await solanasign.getSigner(rpc, privateKey);
      break;

    case "Osmosis":
      signer = await cosmwasmSign.getSigner(rpc, privateKey);
      break;

    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }

  return signer;
}

async function createChainContext(wh, chainType) {
  let key;
  let userAddr;
  switch (chainType) {
    case "Solana":
      key = config.solana.privateKey;
      userAddr = config.solana.userAddr;
      break;
    case "Osmosis":
      key = config.osmosis.mnemonic;
      userAddr = config.osmosis.userAddr;
      break;
    default:
      throw new Error(`Unsupported chain type: ${chainType}`);
  }

  const chain = wh.getChain(chainType);
  const signer = await initializeSigner(chainType, await chain.getRpc(), key);

  if (signer.address() !== userAddr) {
    throw new Error(`Signer address does not match: ${chainType}`);
  }

  return {
    chain,
    signer,
    address: Wormhole.chainAddress(chain.chain, signer.address()),
  };
}

async function checkTokenWrappingStatus(chain, tokenId) {
  try {
    const tb = await chain.getTokenBridge();
    const wrapped = await tb.getWrappedAsset(tokenId);
    console.log(`Token wrapped status on chain:`, wrapped);
    return wrapped;
  } catch (e) {
    console.log(`Token not yet wrapped on chain:`, e.message);
    return null;
  }
}

async function handleTokenAttestation(sendChain, tokenId, sourceSigner) {
  const tb = await sendChain.getTokenBridge();
  try {
    const txGenerator = tb.createAttestation(tokenId);
    const txids = await signSendWait(sendChain, txGenerator, sourceSigner);
    console.log("Token attestation completed:", txids);
    return txids;
  } catch (e) {
    console.log(`Token attestation failed:`, e.message);
    return null;
  }
}

async function executeAutomaticTransfer(xfer, source) {
  try {
    const srcTxids = await xfer.initiateTransfer(source.signer);
    console.log("Source chain transaction IDs (automatic mode):", srcTxids);
    return { sourceChainTxs: srcTxids };
  } catch (error) {
    console.warn("Automatic transfer failed:", error.message);
    return null;
  }
}

async function executeManualTransfer(xfer, source, destination) {
  const srcTxids = await xfer.initiateTransfer(source.signer);
  console.log("Source transaction initiated:", srcTxids);

  console.log("Waiting for attestation...");
  const attestIds = await xfer.fetchAttestation(600_000);
  console.log("Attestation received:", attestIds);

  console.log("Completing transfer on destination chain...");
  const destTxids = await xfer.completeTransfer(destination.signer);
  console.log("Destination transaction completed:", destTxids);

  return {
    sourceChainTxs: srcTxids,
    attestation: attestIds,
    destinationChainTxs: destTxids,
  };
}

async function executeTransfer(xfer, source, destination, quote) {
  try {
    let result;

    if (xfer.transfer.automatic) {
      result = await executeAutomaticTransfer(xfer, source);
      if (result) {
        return { ...result, quote };
      }
      console.log("Falling back to manual transfer mode...");
      xfer.transfer.automatic = false;
    }

    result = await executeManualTransfer(xfer, source, destination);
    return { ...result };
  } catch (error) {
    console.error("Transfer execution failed:", error);
    throw error;
  }
}

export async function startbridge(options) {
  console.log("startbridge");

  try {
    console.log("Initializing Wormhole bridge...");
    const wh = await wormhole("Mainnet", [solana, cosmwasm]);

    console.log("Setting up chain contexts...");
    const source = await createChainContext(wh, options.sendChain);

    const destination = await createChainContext(wh, options.rcvChain);

    console.log("Checking token wrapping status...");
    const wrappedStatus = await checkTokenWrappingStatus(
      destination.chain,
      options.tokenId
    );
    if (!wrappedStatus) {
      console.log("Initiating token attestation...");
      await handleTokenAttestation(
        source.chain,
        options.tokenId,
        source.signer
      );
    }

    console.log("Getting token decimals...");
    const decimals = isTokenId(options.tokenId)
      ? Number(
          await wh.getDecimals(options.tokenId.chain, options.tokenId.address)
        )
      : source.chain.config.nativeTokenDecimals;

    console.log("Token decimals:", decimals);
    console.log("Input amount:", options.amount);

    console.log("Creating transfer object...");
    const xfer = await wh.tokenTransfer(
      options.tokenId,
      amount.units(amount.parse(options.amount, decimals)),
      source.address,
      destination.address,
      options.automatic ?? false,
      undefined,
      undefined
    );
    console.log("Getting xfer...", xfer);

    // console.log("Getting transfer quote...");
    // const quote = await TokenTransfer.quoteTransfer(
    //   wh,
    //   source.chain,
    //   destination.chain,
    //   xfer.transfer
    // );
    // console.log("Transfer quote:", quote);

    // if (!options.execute) {
    //   console.log("Quote only mode, returning quote");
    //   return quote;
    // }

    // if (xfer.transfer.automatic && quote.destinationToken.amount < 0) {
    //   throw new Error(
    //     "The amount requested is too low to cover the fee and any native gas requested."
    //   );
    // }

    console.log("Executing transfer...");
    return await executeTransfer(xfer, source, destination);
  } catch (error) {
    console.error("Error in bridge transfer:", error);
    throw error;
  }
}
