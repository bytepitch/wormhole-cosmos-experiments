import {
  NATIVE_MINT,
  createSyncNativeInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getKeypairFromEnvironment } from '@solana-developers/helpers';
import 'dotenv/config';

(async () => {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed'),
    wallet = getKeypairFromEnvironment('SOL_PRIVATE_KEY');
  console.log('HELP', wallet.secretKey);

  // Const airdropSignature = await connection.requestAirdrop(
  //   Wallet.publicKey,
  //   2 * LAMPORTS_PER_SOL,
  // );

  // Await connection.confirmTransaction(airdropSignature);

  // Const associatedTokenAccount = await getAssociatedTokenAddress(
  //   NATIVE_MINT,
  //   Wallet.publicKey
  // )

  const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      NATIVE_MINT,
      wallet.publicKey,
    ),
    // Create token account to hold your wrapped SOL
    // Const ataTransaction = new Transaction()
    //   .add(
    //     CreateAssociatedTokenAccountInstruction(
    //       Wallet.publicKey,
    //       TokenAccount,
    //       Wallet.publicKey,
    //       NATIVE_MINT
    //     )
    //   );

    // Await sendAndConfirmTransaction(connection, ataTransaction, [wallet]);

    // Transfer SOL to associated token account and use SyncNative to update wrapped SOL balance
    solTransferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: tokenAccount.address.toBase58(),
        lamports: LAMPORTS_PER_SOL,
      }),
      createSyncNativeInstruction(tokenAccount.address.toBase58()),
    );

  await sendAndConfirmTransaction(connection, solTransferTransaction, [wallet]);

  const accountInfo = await getAccount(connection, tokenAccount.address);

  console.log(
    `Native: ${accountInfo.isNative}, Lamports: ${accountInfo.amount}`,
  );
})();
