import {NATIVE_MINT, getAssociatedTokenAddress, createSyncNativeInstruction, getAccount, getOrCreateAssociatedTokenAccount} from "@solana/spl-token";
import {clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction} from "@solana/web3.js";
import {
    getKeypairFromEnvironment,
  } from "@solana-developers/helpers";
import "dotenv/config";

(async () => {

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

const wallet = getKeypairFromEnvironment("SOL_PRIVATE_KEY");
console.log('HELP', wallet.secretKey)

// const airdropSignature = await connection.requestAirdrop(
//   wallet.publicKey,
//   2 * LAMPORTS_PER_SOL,
// );

// await connection.confirmTransaction(airdropSignature);

// const associatedTokenAccount = await getAssociatedTokenAddress(
//   NATIVE_MINT,
//   wallet.publicKey
// )

const tokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  wallet,
  NATIVE_MINT,
  wallet.publicKey,
);


// Create token account to hold your wrapped SOL
// const ataTransaction = new Transaction()
//   .add(
//     createAssociatedTokenAccountInstruction(
//       wallet.publicKey,
//       tokenAccount,
//       wallet.publicKey,
//       NATIVE_MINT
//     )
//   );

// await sendAndConfirmTransaction(connection, ataTransaction, [wallet]);

// Transfer SOL to associated token account and use SyncNative to update wrapped SOL balance
const solTransferTransaction = new Transaction()
  .add(
    SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: tokenAccount.address.toBase58(),
        lamports: LAMPORTS_PER_SOL
      }),
      createSyncNativeInstruction(
        tokenAccount.address.toBase58()
    )
  )

await sendAndConfirmTransaction(connection, solTransferTransaction, [wallet]);

const accountInfo = await getAccount(connection, tokenAccount.address);

console.log(`Native: ${accountInfo.isNative}, Lamports: ${accountInfo.amount}`);

})();