import test from "ava";
import { Buffer } from "buffer";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import borsh from "borsh";
import fs from "fs";
import os from "os";

function createKeypairFromFile(path) {
  return Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(path, "utf-8")))
  );
}

test.before(async (t) => {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const payer = createKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);
  const programId = createKeypairFromFile(
    "./program/target/deploy/counter_solana_native-keypair.json"
  ).publicKey;
  const counterAccount = Keypair.generate();

  const COUNTER_ACCOUNT_SIZE = 8;

  class Counter {
    count;
    constructor(fields = { count: 0 }) {
      this.count = fields.count;
    }

    toBuffer() {
      return Buffer.from(borsh.serialize(CounterSchema, this));
    }

    static fromBuffer(buffer) {
      return borsh.deserialize(CounterSchema, Counter, buffer);
    }
  }

  const CounterSchema = new Map([
    [Counter, { kind: "struct", fields: [["count", "u64"]] }],
  ]);

  t.context = {
    connection,
    payer,
    programId,
    counterAccount,
    COUNTER_ACCOUNT_SIZE,
    Counter,
  };
});

test.serial("Initialize the counter!", async (t) => {
  const {
    connection,
    payer,
    programId,
    counterAccount,
    COUNTER_ACCOUNT_SIZE,
    Counter,
  } = t.context;
  const lamports = await connection.getMinimumBalanceForRentExemption(
    COUNTER_ACCOUNT_SIZE
  );

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: counterAccount.publicKey,
    lamports,
    space: COUNTER_ACCOUNT_SIZE,
    programId,
  });

  const transaction = new Transaction().add(createAccountIx);
  await sendAndConfirmTransaction(connection, transaction, [
    payer,
    counterAccount,
  ]);

  const accountInfo = await connection.getAccountInfo(counterAccount.publicKey);
  t.assert(accountInfo);
  const counter = Counter.fromBuffer(accountInfo.data);
  t.is(counter.count.toNumber(), 0);
  console.log("Counter initialized with count:", counter.count.toNumber());
});

test.serial("Increment the counter!", async (t) => {
  const { connection, payer, programId, counterAccount, Counter } = t.context;

  const incrementIx = new TransactionInstruction({
    keys: [
      { pubkey: counterAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    programId,
    data: Buffer.from([0]),
  });

  const transaction = new Transaction().add(incrementIx);
  await sendAndConfirmTransaction(connection, transaction, [payer]);

  const accountInfo = await connection.getAccountInfo(counterAccount.publicKey);
  t.assert(accountInfo);
  const counter = Counter.fromBuffer(accountInfo.data);
  t.is(counter.count.toNumber(), 1);
  console.log("Counter incremented to:", counter.count.toNumber());
});
