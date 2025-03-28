use bridge::{
    accounts::{
        PostedVAA,
        PostedVAADerivationData,
    },
    PostVAA,
    SerializePayload,
};
use libsecp256k1::SecretKey;
use primitive_types::U256;
use rand::Rng;
use solana_program::pubkey::Pubkey;
use solana_program_test::{
    tokio,
    BanksClient,
};
use solana_sdk::{
    signature::{
        Keypair,
        Signer,
    },
    transport::TransportError,
};
use solitaire::{
    processors::seeded::Seeded,
    AccountState,
};
use std::{
    collections::HashMap,
    fmt,
    str::FromStr,
};
use token_bridge::{
    accounts::ConfigAccount,
    instructions,
    messages::PayloadTransferWithPayload,
    types::*,
};

mod common;

const CHAIN_ID_SOLANA: u16 = 1;
const CHAIN_ID_ETH: u16 = 2;

/// Small helper to track and provide sequences during tests. This is in particular needed for
/// guardian operations that require them for derivations.
struct Sequencer {
    sequences: HashMap<[u8; 32], u64>,
}

struct Context {
    /// Guardian public keys.
    guardians: Vec<[u8; 20]>,

    /// Guardian secret keys.
    guardian_keys: Vec<SecretKey>,

    /// Address of the core bridge contract.
    bridge: Pubkey,

    /// Shared RPC client for tests to make transactions with.
    client: BanksClient,

    /// Payer key with a ton of lamports to ease testing with.
    payer: Keypair,

    /// Track nonces throughout the tests.
    seq: Sequencer,

    /// Address of the token bridge itself that we wish to test.
    token_bridge: Pubkey,

    /// Keypairs for mint information, required in multiple tests.
    mint_authority: Keypair,
    mint: Keypair,
    mint_meta: Pubkey,

    /// Keypairs for test token accounts.
    token_authority: Keypair,
    token_account: Keypair,
    metadata_account: Pubkey,
}

async fn set_up() -> Result<Context, TransportError> {
    let (guardians, guardian_keys) = common::generate_keys(6);

    let (mut client, payer, bridge, token_bridge) = common::setup().await;

    // Setup a Bridge to test against.
    common::initialize_bridge(&mut client, bridge, &payer, &guardians).await?;

    // Context for test environment.
    let mint = Keypair::new();
    let mint_pubkey = mint.pubkey();
    let metadata_pubkey = Pubkey::from_str("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").unwrap();

    // SPL Token Meta
    let metadata_seeds = &[
        "metadata".as_bytes(),
        metadata_pubkey.as_ref(),
        mint_pubkey.as_ref(),
    ];

    let (metadata_key, _metadata_bump_seed) = Pubkey::find_program_address(
        metadata_seeds,
        &Pubkey::from_str("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").unwrap(),
    );

    // Token Bridge Meta
    use token_bridge::accounts::WrappedTokenMeta;
    let metadata_account = WrappedTokenMeta::<'_, { AccountState::Uninitialized }>::key(
        &token_bridge::accounts::WrappedMetaDerivationData {
            mint_key: mint_pubkey,
        },
        &token_bridge,
    );

    let mut context = Context {
        guardians,
        guardian_keys,
        seq: Sequencer {
            sequences: HashMap::new(),
        },
        bridge,
        client,
        payer,
        token_bridge,
        mint_authority: Keypair::new(),
        mint,
        mint_meta: metadata_account,
        token_account: Keypair::new(),
        token_authority: Keypair::new(),
        metadata_account: metadata_key,
    };

    // Create a mint for use within tests.
    common::create_mint(
        &mut context.client,
        &context.payer,
        &context.mint_authority.pubkey(),
        &context.mint,
    )
    .await?;

    // Create Token accounts for use within tests.
    common::create_token_account(
        &mut context.client,
        &context.payer,
        &context.token_account,
        &context.token_authority.pubkey(),
        &context.mint.pubkey(),
    )
    .await?;

    // Mint tokens
    common::mint_tokens(
        &mut context.client,
        &context.payer,
        &context.mint_authority,
        &context.mint,
        &context.token_account.pubkey(),
        1000,
    )
    .await?;

    // Initialize the token bridge.
    common::initialize(
        &mut context.client,
        context.token_bridge,
        &context.payer,
        context.bridge,
    )
    .await
    .unwrap();

    // Verify Token Bridge State
    let config_key = ConfigAccount::<'_, { AccountState::Uninitialized }>::key(None, &token_bridge);
    let config: Config = common::get_account_data(&mut context.client, config_key)
        .await
        .unwrap();
    assert_eq!(config.wormhole_bridge, bridge);

    Ok(context)
}

#[tokio::test]
async fn init() {
    let Context {
        ref payer,
        ref mut client,
        bridge,
        token_bridge,
        mint_authority: _,
        ref mint,
        mint_meta: _,
        metadata_account: _,
        ref token_authority,
        ref guardian_keys,
        ..
    } = set_up().await.unwrap();

    let nonce = rand::thread_rng().gen();
    let from_address = Keypair::new().pubkey().to_bytes();
    let payload: Vec<u8> = vec![1, 2, 3];
    let payload = PayloadTransferWithPayload {
        amount: U256::from(100u128),
        token_address: mint.pubkey().to_bytes(),
        token_chain: CHAIN_ID_SOLANA,
        to: token_authority.pubkey().to_bytes(),
        to_chain: CHAIN_ID_SOLANA,
        from_address,
        payload,
    };
    let message = payload.try_to_vec().unwrap();

    let (vaa, body, _) = common::generate_vaa([0u8; 32], CHAIN_ID_ETH, message, nonce, 1);
    let signature_set = common::verify_signatures(client, &bridge, payer, body, guardian_keys, 0)
        .await
        .unwrap();
    common::post_vaa(client, bridge, payer, signature_set, vaa.clone())
        .await
        .unwrap();
    let msg_derivation_data = &PostedVAADerivationData {
        payload_hash: body.to_vec(),
    };
    let message_key =
        PostedVAA::<'_, { AccountState::MaybeInitialized }>::key(msg_derivation_data, &bridge);

    // common::init(client, program, payer, message_key);
}
