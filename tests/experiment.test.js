import test from 'ava';
import { wormhole, GatewayTransfer, Wormhole, amount } from "@wormhole-foundation/sdk";
import { getCosmwasmSigner } from "@wormhole-foundation/sdk-cosmwasm";
import { getSolanaSignAndSendSigner } from "@wormhole-foundation/sdk-solana";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import sol from "@wormhole-foundation/sdk/solana";
import { configDotenv } from 'dotenv';

const config = {
    osmosis: {
        faucet: 'https://faucet.testnet.osmosis.zone/',
        userAddr: 'osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6',
    },
    solana: {
        faucet: 'https://faucet.solana.com/',
        userAddr: 'B2VfpvVnkCupEf2AYXdDuNun8JpoeV36pFWgVmwv3qsR'
    }
};

test('config', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Wormchain');
    console.log(await osmosis.getIbcBridge())
    t.pass()
})

test.only('to Solana', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    // console.log({solana: solana.config.tokenMap})

    configDotenv();
    const osmosisSigner = await getCosmwasmSigner(await osmosis.getRpc(), process.env['COSMOS_MNEMONIC']);
    const solSigner = await getSolanaSignAndSendSigner(await solana.getRpc(), process.env['SOL_PRIVATE_KEY'])
    
    t.is(osmosisSigner.address(), config.osmosis.userAddr);
    t.is(solSigner.address(), config.solana.userAddr);

    const cosmosTokenAddress = Wormhole.parseAddress("Osmosis", 'factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/5Mt8WMcNw6541TKyijWWH8HSBZDkKteBQhP3oDNTnR4s');
    // const token = { chain: osmosis.chain, address: 'wormhole1gryz69gzl6mz2m66a4twg922jtlc47nlx73sxv88lvq86du5zvyqz3mt23'};

    const xfer = await GatewayTransfer.from(wh, {
        token: { chain: osmosis.chain, address: cosmosTokenAddress },
        amount: 1n,
        from: {
            chain: osmosis.chain,
            signer: osmosisSigner,
            address: Wormhole.chainAddress(osmosis.chain, osmosisSigner.address())
        },
        to: {
            chain: solana.chain,
            signer: solSigner,
            address: Wormhole.chainAddress(solana.chain, solSigner.address())
        },
      });

    console.log(xfer)  
});

test('to Cosmos', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    // console.log({solana: solana.config.tokenMap})

    configDotenv();
    const osmosisSigner = await getCosmwasmSigner(await osmosis.getRpc(), process.env['COSMOS_MNEMONIC']);
    const solSigner = await getSolanaSignAndSendSigner(await solana.getRpc(), process.env['SOL_PRIVATE_KEY'])
    
    t.is(osmosisSigner.address(), config.osmosis.userAddr);
    t.is(solSigner.address(), config.solana.userAddr);

    // we'll use the native token on the source chain
    const token = Wormhole.tokenId(solana.chain, "native");
    const amt = amount.units(amount.parse("0.001", solana.config.nativeTokenDecimals));

    const osmoSignStuff = {
        chain: osmosis.chain,
        signer: osmosisSigner,
        address: Wormhole.chainAddress(osmosis.chain, osmosisSigner.address())
    };
    const solanaSignStuff = {
        chain: solana.chain,
        signer: solSigner,
        address: Wormhole.chainAddress(solana.chain, solSigner.address())
    };

    const xfer = await GatewayTransfer.from(wh, {
        token: token,
        amount: amt,
        from: solanaSignStuff.address,
        to: osmoSignStuff.address,
      });

    console.log('XFER', xfer);

    const srcTxIds = await xfer.initiateTransfer(solanaSignStuff.signer);
    console.log("Started transfer on source chain", srcTxIds);

    const attests = await xfer.fetchAttestation(600_000);
    console.log("Got Attestations", attests);
})

// ibc/B5D53105A7AA2BEC4DA4B3304228F3856219AE7CF84A9023043C481629E3E319