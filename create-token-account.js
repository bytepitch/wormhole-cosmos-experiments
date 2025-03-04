import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import 'dotenv/config';
import {
  getExplorerLink,
  getKeypairFromEnvironment,
} from '@solana-developers/helpers';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
const connection = new Connection(clusterApiUrl('devnet')),
  user = getKeypairFromEnvironment('SOL_PRIVATE_KEY');

console.log(
  `🔑 Loaded our keypair securely, using an env file! Our public key is: ${user.publicKey.toBase58()}`,
);

// Substitute in your token mint account from create-token-mint.ts
const tokenMintAccount = new PublicKey(
    'So11111111111111111111111111111111111111112',
  ),
  // Here we are making an associated token account for our own address, but we can
  // Make an ATA on any other wallet in devnet!
  // Const recipient = new PublicKey("SOMEONE_ELSES_DEVNET_ADDRESS");
  recipient = user.publicKey,
  tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    user,
    tokenMintAccount,
    recipient,
  );

console.log(`Token Account: ${tokenAccount.address.toBase58()}`);

const link = getExplorerLink(
  'address',
  tokenAccount.address.toBase58(),
  'devnet',
);

console.log(`✅ Created token Account: ${link}`);
