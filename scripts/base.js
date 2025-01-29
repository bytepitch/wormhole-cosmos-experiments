import {
    TokenTransfer,
    Wormhole,
    amount,
    isTokenId,
    routes,
    signSendWait,
    wormhole
} from ('@wormhole-foundation/sdk');

import evm from ('@wormhole-foundation/sdk/evm').default;
import solana from ('@wormhole-foundation/sdk/solana').default;
import solanasign from ("@wormhole-foundation/sdk/platforms/solana").default;
import evmSign from ("@wormhole-foundation/sdk/platforms/evm").default;
import solsign from ("@wormhole-foundation/sdk-solana");
import dotenv from ('dotenv');
dotenv.config();

const SIGNER_CONFIG = {
    solana: {
        debug: true,
        priorityFee: {
            percentile: 0.5,
            percentileMultiple: 2,
            min: 1,
            max: 20,
        }
    },
    evm: {
        debug: true,
        maxGasLimit: amount.units(amount.parse("0.01", 18))
    }
};

async function initializeSigner(chain, rpc, privateKey) {
    let signer;
    let signerConfig;

    switch (chain) {
        case "Solana":
            signerConfig = SIGNER_CONFIG.solana;
            signer = await solanasign.getSigner(rpc, privateKey, signerConfig);
            break;

        case "Base":
        case "Ethereum":
            signerConfig = SIGNER_CONFIG.evm;
            signer = await evmSign.getSigner(rpc, privateKey, signerConfig);
            break;


        default:
            throw new Error(`Unsupported chain: ${chain}`);
    }

    return signer;
}

async function createChainContext(wh, chainType) {
    // 获取私钥
    let key;
    switch (chainType) {
        case "Solana":
            key = process.env.SOL_PRIVATE_KEY;
            break;
        case "Base":
        case "Ethereum":
            key = process.env.BASE_PRIVATE_KEY;
            break;
        default:
            throw new Error(`Unsupported chain type: ${chainType}`);
    }

    const chain = wh.getChain(chainType);
    const signer = await initializeSigner(chainType, await chain.getRpc(), key);

    return {
        chain,
        signer,
        address: Wormhole.chainAddress(chain.chain, signer.address())
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
        console.log('Token attestation completed:', txids);
        return txids;
    } catch (e) {
        console.log(`Token attestation failed:`, e.message);
        return null;
    }
}

async function executeAutomaticTransfer(xfer, source) {
    try {
        const srcTxids = await xfer.initiateTransfer(source.signer);
        console.log('Source chain transaction IDs (automatic mode):', srcTxids);
        return { sourceChainTxs: srcTxids };
    } catch (error) {
        console.warn('Automatic transfer failed:', error.message);
        return null;
    }
}

async function executeManualTransfer(xfer, source, destination) {
    const srcTxids = await xfer.initiateTransfer(source.signer);
    console.log('Source transaction initiated:', srcTxids);

    console.log('Waiting for attestation...');
    const attestIds = await xfer.fetchAttestation(180_000);
    console.log('Attestation received:', attestIds);

    console.log('Completing transfer on destination chain...');
    const destTxids = await xfer.completeTransfer(destination.signer);
    console.log('Destination transaction completed:', destTxids);

    return {
        sourceChainTxs: srcTxids,
        attestation: attestIds,
        destinationChainTxs: destTxids
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
            console.log('Falling back to manual transfer mode...');
            xfer.transfer.automatic = false;
        }

        result = await executeManualTransfer(xfer, source, destination);
        return { ...result, quote };

    } catch (error) {
        console.error('Transfer execution failed:', error);
        throw error;
    }
}

async function startbridge(options) {
    try {
        console.log('Initializing Wormhole bridge...');
        const wh = await wormhole('Mainnet', [solana, evm]);

        console.log('Setting up chain contexts...');
        const source = await createChainContext(
            wh,
            options.sendChain
        );

        const destination = await createChainContext(
            wh,
            options.rcvChain
        );


        console.log('Checking token wrapping status...');
        const wrappedStatus = await checkTokenWrappingStatus(destination.chain, options.tokenId);
        if (!wrappedStatus) {
            console.log('Initiating token attestation...');
            await handleTokenAttestation(source.chain, options.tokenId, source.signer);
        }

        console.log('Getting token decimals...');
        const decimals = isTokenId(options.tokenId)
            ? Number(await wh.getDecimals(options.tokenId.chain, options.tokenId.address))
            : source.chain.config.nativeTokenDecimals;

        console.log('Token decimals:', decimals);
        console.log('Input amount:', options.amount);

        console.log('Creating transfer object...');
        const xfer = await wh.tokenTransfer(
            options.tokenId,
            amount.units(amount.parse(options.amount, decimals)),
            source.address,
            destination.address,
            options.automatic ?? false,
            undefined,
            undefined
        );

        console.log('Getting transfer quote...');
        const quote = await TokenTransfer.quoteTransfer(
            wh,
            source.chain,
            destination.chain,
            xfer.transfer
        );
        console.log('Transfer quote:', quote);

        if (!options.execute) {
            console.log('Quote only mode, returning quote');
            return quote;
        }

        if (xfer.transfer.automatic && quote.destinationToken.amount < 0) {
            throw new Error('The amount requested is too low to cover the fee and any native gas requested.');
        }

        console.log('Executing transfer...');
        return await executeTransfer(xfer, source, destination, quote);

    } catch (error) {
        console.error('Error in bridge transfer:', error);
        throw error;
    }
}

module.exports = {
    startbridge
};