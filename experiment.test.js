import test from 'ava';
import { wormhole, GatewayTransfer, Wormhole, amount } from "@wormhole-foundation/sdk";
import { getCosmwasmSigner } from "@wormhole-foundation/sdk-cosmwasm";
import { getSolanaSignAndSendSigner, getSolanaSigner, SolanaPlatform } from "@wormhole-foundation/sdk-solana";
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

test.skip('config', async t => {
    const wh = await wormhole("Mainnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    const route = await GatewayTransfer.from(
        wh,
        {
          chain: solana.chain,
          txid: "4FdzDXXXzBVJBYtboevmL4JW1kwLMjNPMhHRTsSLqs3cFLWqau3CMSdnHk5SUB3AjQM5xUHNUGMng7s6aWBBHuab",
        },
        600_000,);

    console.log(route.ibcTransfers)    
    console.log(route.ibcTransfers[0].data)    
    console.log(route.ibcTransfers[1].data)    

    t.pass()
})

test('to Solana', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    configDotenv();
    const osmosisSigner = await getCosmwasmSigner(await osmosis.getRpc(), process.env['COSMOS_MNEMONIC']);
    const solSigner = await (await sol()).getSigner(await solana.getRpc(), process.env['SOL_PRIVATE_KEY'], { debug: true })
    
    t.is(osmosisSigner.address(), config.osmosis.userAddr);
    t.is(solSigner.address(), config.solana.userAddr);

    const cosmosTokenAddress = Wormhole.parseAddress("Wormchain", 'factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/5Mt8WMcNw6541TKyijWWH8HSBZDkKteBQhP3oDNTnR4s');
    const token = { chain: osmosis.chain, address: cosmosTokenAddress};

    const xfer = await GatewayTransfer.from(wh, {
        token,
        amount: 100000n,
        from: {
            chain: osmosis.chain,
            signer: osmosisSigner,
            address: Wormhole.chainAddress(osmosis.chain, osmosisSigner.address()).address
        },
        to: {
            chain: solana.chain,
            signer: solSigner,
            address: Wormhole.chainAddress(solana.chain, solSigner.address()).address
        },
      });

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