import test from 'ava';
import { wormhole, GatewayTransfer, Wormhole, amount, chain, signSendWait, createVAA, serialize, deserialize, UniversalAddress } from "@wormhole-foundation/sdk";
import { getCosmwasmSigner } from "@wormhole-foundation/sdk-cosmwasm";
import { getSolanaSignAndSendSigner, getSolanaSigner, SolanaPlatform } from "@wormhole-foundation/sdk-solana";
import cosmwasm from "@wormhole-foundation/sdk/cosmwasm";
import sol from "@wormhole-foundation/sdk/solana";
import { configDotenv } from 'dotenv';
import { createPayload3 } from './generateVaa.js';

import {
    sign,
    serialiseVAA,
  } from "@certusone/wormhole-sdk";

const config = {
    osmosis: {
        faucet: 'https://faucet.testnet.osmosis.zone/',
        userAddr: 'osmo1lwc58qfnwycw990cvq0yefnjqqvjgadlyaxdp6',
        ibcChannelOverride: [{ chain: 'Wormchain', channel: 'channel-9867' }]
    },
    solana: {
        faucet: 'https://faucet.solana.com/',
        userAddr: 'B2VfpvVnkCupEf2AYXdDuNun8JpoeV36pFWgVmwv3qsR'
    }
};

const overrideIbcChannelInfo = async (ibcChain, overrides) => {
    const rawInfo = await ibcChain.getIbcBridge();
    const channelToChain = new Map();
    const chainToChannel = new Map();
    rawInfo.chainToChannel = chainToChannel;
    rawInfo.channelToChain = channelToChain;

    for (const {chain, channel} of overrides) {
        chainToChannel.set(chain, channel);
        channelToChain.set(channel, chain);
    };
};

test('config', async t => {
    const wh = await wormhole("Mainnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Wormchain');
    const solana = wh.getChain('Solana');

    console.log('HELP', osmosis.config.contracts)

    // const route = await GatewayTransfer.from(
    //     wh,
    //     {
    //       chain: solana.chain,
    //       txid: "4FdzDXXXzBVJBYtboevmL4JW1kwLMjNPMhHRTsSLqs3cFLWqau3CMSdnHk5SUB3AjQM5xUHNUGMng7s6aWBBHuab",
    //     },
    //     600_000,);

    // console.log(route.ibcTransfers)    
    // console.log(route.ibcTransfers[0].data)    
    // console.log(route.ibcTransfers[1].data)

    // const rawInfo = await osmosis.getIbcBridge();

    // await overrideIbcChannelInfo(osmosis, [{ chain: 'Wormchain', channel: 'channel-9867'}, { chain: 'Agoric', channel: 'channel-1'}]);
    // const overriddenInfo = await osmosis.getIbcBridge();

    // console.log('OSMO', overriddenInfo)

    // t.deepEqual(overriddenInfo, rawInfo)
    t.pass()
})

test('to Solana', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    configDotenv();
    const osmosisSigner = await getCosmwasmSigner(await osmosis.getRpc(), process.env['COSMOS_MNEMONIC']);
    const solSigner = await (await sol()).getSigner(await solana.getRpc(), process.env['SOL_PRIVATE_KEY']);
    
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

test('to Solana, relayer pays redeeming', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    configDotenv();
    const osmosisSigner = await getCosmwasmSigner(await osmosis.getRpc(), process.env['COSMOS_MNEMONIC']);
    const solSigner = await (await sol()).getSigner(await solana.getRpc(), process.env['SOL_PRIVATE_KEY']);
    const relayerSigner = await (await sol()).getSigner(await solana.getRpc(), process.env['SOL_RELAYER_PRIVATE_KEY']);

    await overrideIbcChannelInfo(osmosis, [{ chain: 'Wormchain', channel: 'channel-9867'} ]);
    const dummy = {
        ...wh,
        getChain: wh.getChain,
        getPlatform: wh.getPlatform,
    };
    wh.getChain = function(chainName) {
        if(chainName === osmosis.chain) return osmosis;
        return dummy.getChain(chainName);
    }
    
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
  
    // const attests = await xfer.fetchAttestation(600_000);
    // console.log("Got attests", attests);
  
    // // Since we're leaving cosmos, this is required to complete the transfer
    // const dstTxIds = await xfer.completeTransfer(relayerSigner);
    // console.log("Completed transfer on destination chain", dstTxIds);
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
    const amt = amount.units(amount.parse("0.01", solana.config.nativeTokenDecimals));

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
});

test.skip('resume tx', async t => {
    const wh = await wormhole("Testnet", [cosmwasm, sol]);

    const osmosis = wh.getChain('Osmosis');
    const solana = wh.getChain('Solana');

    configDotenv();
    const osmosisSigner = await getCosmwasmSigner(await osmosis.getRpc(), process.env['COSMOS_MNEMONIC_M']);
    const solSigner = await (await sol()).getSigner(await solana.getRpc(), process.env['SOL_PRIVATE_KEY_M']);
    const relayerSigner = await (await sol()).getSigner(await solana.getRpc(), process.env['SOL_RELAYER_PRIVATE_KEY'], { debug: true });

    const xfer = await GatewayTransfer.from(
        wh,
        {
          chain: 'Osmosis',
          txid: "17A53DE03FDD42E9ABEE4DCBF27021B4E721A87FDD7B73BD36EF8254682F3322",
        },
        600_000
    );

   console.log('xfer')

    // console.log("Created GatewayTransfer: ", xfer.transfer);
    // const srcTxIds = await xfer.initiateTransfer(osmosisSigner);
    // console.log("Started transfer on source chain", srcTxIds);
  
    // const attests = await xfer.fetchAttestation(600_000);
    // console.log("Got attests", attests);
  
    // Since we're leaving cosmos, this is required to complete the transfer
    // const dstTxIds = await xfer.completeTransfer(relayerSigner);
    // console.log("Completed transfer on destination chain", dstTxIds);

    t.pass();
  
});

test('attest', async t => {
    const wh = await wormhole("Devnet", [cosmwasm], {
        chains: {
            "Wormchain": {
                rpc: 'http://localhost:26659/'
            }
        }
    });
    const attestVAA = '01000000000100aa317202bafeafba66ba87f225fe7a3a40b1ec64caedb0c48f8a1c1e64b66c4369a8d54a36ed2fbd1ce233f20c2c3b058506e61990f8422cbb218989918635a10100000001000000010001c69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f00000000051793740002165809739240a0ac03b98440fe8985548e3aa683cd0d4d9df5b5659669faa301000106534f4c540000000000000000000000000000000000000000000000000000000077534f4c54000000000000000000000000000000000000000000000000000000';
    const testMnemonic = 'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius';

    const wormchain = wh.getChain('Wormchain');
    const client = await wormchain.getRpc();
    console.log(await client.queryClient.bank.balances('wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq'))
    const wormchainSigner = await (await cosmwasm()).getSigner(await wormchain.getRpc(), testMnemonic)

    const tb = await wormchain.getTokenBridge();
    const tx = tb.submitAttestation(attestVAA, 'wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq');
    await signSendWait(wormchain, tx, wormchainSigner);
    t.pass()
});

test.skip('createVaa', async t => {

    const testTokenAddr = Wormhole.parseAddress("Solana", "2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
    const emitterAddress = Wormhole.parseAddress("Solana", "ENG1wQ7CQKH8ibAJ1hSLmJgL9Ucg6DRDbj752ZAfidLA");
    const receiver = Wormhole.parseAddress("Wormchain", "wormhole1cyyzpxplxdzkeea7kwsydadg87357qna3zg3tq")

    const tokenBridgeVaaBytes = serialize(
        createVAA("TokenBridge:TransferWithPayload", {
          guardianSet: 0,
          timestamp: 1,
          nonce: 421,
          emitterChain: "Solana",
          emitterAddress: emitterAddress.toUniversalAddress(),
          sequence: 85431157n,
          consistencyLevel: 0,
          signatures: [],
          payload: {
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
          },
        }),
      );

      console.log(testTokenAddr.toUniversalAddress().toString());
      console.log(emitterAddress.toUniversalAddress().toString());
      console.log(Buffer.from(tokenBridgeVaaBytes).toString('hex'))
        
    t.pass();  
});

test.only('create payload 3', async t => {

    const testTokenAddr = Wormhole.parseAddress("Solana", "2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
    const emitterAddress = Wormhole.parseAddress("Solana", "ENG1wQ7CQKH8ibAJ1hSLmJgL9Ucg6DRDbj752ZAfidLA");
    const ibcTranslator = Wormhole.parseAddress("Wormchain", "wormhole1wn625s4jcmvk0szpl85rj5azkfc6suyvf75q6vrddscjdphtve8sca0pvl");

    let transferVaa = {
        version: 1,
        guardianSetIndex: 0,
        signatures: [],
        timestamp: 0,
        nonce: 0,
        emitterChain: 1,
        emitterAddress: emitterAddress.toUniversalAddress().toString(),
        sequence: BigInt(Math.floor(Math.random() * 100000000)),
        consistencyLevel: 0,
      };

    const amount = 1000000000; // Example amount
    const tokenAddr = testTokenAddr.toUniversalAddress().toUint8Array(); // solana contract universal address
    const tokenChain = 1; // solana chain id
    const recipient = ibcTranslator.toUniversalAddress().toUint8Array(); // Recipient addr is ibc translator
    const recipientChain = 3104; // Wormchain id
    const from = emitterAddress.toUniversalAddress().toUint8Array(); // External address
    const terraRecepient = Wormhole.parseAddress("Terra2", "terra1x46rqay4d3cssq8gxxvqz8xt6nwlz4td20k38v")

    const base64EncodedReceiver = new TextEncoder().encode('terra1x46rqay4d3cssq8gxxvqz8xt6nwlz4td20k38v');

    // Encode contract payload
    const contractPayloadObj = {
        "gateway_transfer":{
            "chain":18,
            "fee":"0",
            "nonce":77992,
            "recipient": Buffer.from(base64EncodedReceiver).toString('base64')
        }
    };
    const contractPayloadString = JSON.stringify(contractPayloadObj);
    const contractPayload = new TextEncoder().encode(contractPayloadString);

    const payloadBytes = createPayload3(amount, tokenAddr, tokenChain, recipient, recipientChain, from, contractPayload);
    transferVaa.payload = {
        type: "3",
        hex: '000000000000000000000000000000000000000000000000000000003b9aca00165809739240a0ac03b98440fe8985548e3aa683cd0d4d9df5b5659669faa301000174f4aa42b2c6d967c041f9e83953a2b271a8708c4fa80d306d6c312686eb664f0c20c69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f7b22676174657761795f7472616e73666572223a7b22636861696e223a31382c22666565223a2230222c226e6f6e6365223a37373939322c22726563697069656e74223a7b2230223a35332c2231223a3131362c2232223a34382c2233223a3131362c2234223a3134392c2235223a3130382c2236223a3131332c2237223a382c2238223a302c2239223a3233322c223130223a34392c223131223a3135322c223132223a312c223133223a32382c223134223a3230332c223135223a3231322c223136223a3232312c223137223a3234312c223138223a38352c223139223a3130397d7d7d'
    }


    console.log(Buffer.from(payloadBytes).toString("hex")); // Print as hex string

    transferVaa.signatures = sign(
        ['cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0'],
        transferVaa
      );

      const serialized = Buffer.from(serialiseVAA(transferVaa), "hex");

      console.log('VAA', serialized)
    t.pass();
});

test('update channel info', async t => {
    let updateChannelVaa = {
        version: 1,
        guardianSetIndex: 0,
        signatures: [],
        timestamp: 0,
        nonce: 0,
        emitterChain: 1,
        emitterAddress: '0000000000000000000000000000000000000000000000000000000000000004',
        sequence: BigInt(Math.floor(Math.random() * 100000000)),
        consistencyLevel: 0,
        payload: {
          type: "Other",
          hex:
            "000000000000000000000000000000000000004962635472616e736c61746f72" + // module IbcTranslator
            "01" + // action IbcReceiverActionUpdateChannelChain
            "0c20" + // target chain id wormchain
            "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006368616e6e656c2d30" + // channel-0
            "0012", // chain id terra2 (18)
        },
      };
      updateChannelVaa.signatures = sign(
        ['cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0'],
        updateChannelVaa
      );

      const serialized = serialiseVAA(updateChannelVaa);

      console.log(updateChannelVaa);
      console.log(serialized);
      console.log('BASE_64:', Buffer.from(serialized).toString('base64'));
      t.pass()
})

function objectToHex(obj) {
    // Convert object to JSON string
    const jsonString = JSON.stringify(obj);

    // Convert JSON string to byte array (Uint8Array)
    const encoder = new TextEncoder();
    const byteArray = encoder.encode(jsonString);

    // Convert byte array to hex string
    return Array.from(byteArray)
        .map(byte => byte.toString(16).padStart(2, '0')) // Convert each byte to hex
        .join(''); // Join all hex values into a single string
}

const paylaod3 = '03000000000000000000000000000000000000000000000000000000003b9aca00165809739240a0ac03b98440fe8985548e3aa683cd0d4d9df5b5659669faa301000174f4aa42b2c6d967c041f9e83953a2b271a8708c4fa80d306d6c312686eb664f0c20c69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f7b22676174657761795f7472616e73666572223a7b22636861696e223a31382c22666565223a2230222c226e6f6e6365223a37373939322c22726563697069656e74223a2274657272613178343672716179346433637373713867787876717a387874366e776c7a34746432306b333876227d7d';

test('test-vaa', async t => {

    const testTokenAddr = Wormhole.parseAddress("Solana", "2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
    const emitterAddress = Wormhole.parseAddress("Solana", "ENG1wQ7CQKH8ibAJ1hSLmJgL9Ucg6DRDbj752ZAfidLA");
    const ibcTranslator = Wormhole.parseAddress("Wormchain", "wormhole1wn625s4jcmvk0szpl85rj5azkfc6suyvf75q6vrddscjdphtve8sca0pvl");

    const terraRecipient = Wormhole.parseAddress("Terra2", "terra1x46rqay4d3cssq8gxxvqz8xt6nwlz4td20k38v");

    // Encode contract payload
    const contractPayloadObj = {
        "gateway_transfer":{
            "chain":18,
            "fee":0,
            "nonce":7823,
            "recipient":  Buffer.from(terraRecipient.toNative().toUint8Array()).toString('base64')     }
    };

    // Buffer.from(terraRecipient.toUint8Array()).toString('base64')
    const contractPayloadString = JSON.stringify(contractPayloadObj);
    const contractPayload = new TextEncoder().encode(contractPayloadString);
 
    
    let test = {
        "version": 1,
        "guardianSetIndex": 0,
        "signatures": [],
        "timestamp": 1,
        "nonce": 74182,
        "emitterChain": 1,
        "emitterAddress": emitterAddress.toUniversalAddress().toUint8Array(),
        "sequence": "274721",
        "consistencyLevel": 0,
        "payload": {
          "module": "TokenBridge",
          "type": "TransferWithPayload",
          "amount": 1000000000,
          "tokenAddress": testTokenAddr.toUniversalAddress().toUint8Array(),
          "tokenChain": 1,
          "toAddress": ibcTranslator.toUniversalAddress().toUint8Array(),
          "chain": 3104,
          "fromAddress": emitterAddress.toUniversalAddress().toUint8Array(),
          "payload": Buffer.from(contractPayload).toString('hex')
        },
      }

    //   test.payload = paylaod3;

      test.signatures = sign(
        ['cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0'],
        test
      );
  
      console.log(test);

      const serialized = serialiseVAA(test);
      console.log(serialized);
      console.log('BASE_64:', Buffer.from(serialized, 'hex').toString('base64'));
      t.pass()
});


