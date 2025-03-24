import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Buffer } from 'buffer';
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { serialize, deserialize } from 'borsh';
import fs from 'fs';
import os from 'os';

function createKeypairFromFile(path) {
  return Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(path, 'utf-8'))),
  );
}

describe('Counter native ', function () {
  const connection = new Connection('http://localhost:8899', 'confirmed');
  const payer = createKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);
  const programId = createKeypairFromFile(
    './program/target/deploy/counter_solana_native-keypair.json',
  ).publicKey;
  const counterAccount = Keypair.generate();

  const COUNTER_ACCOUNT_SIZE = 8;

  class Counter {
    constructor(fields = { count: 0 }) {
      this.count = fields.count;
    }

    toBuffer() {
      return Buffer.from(serialize(CounterSchema, this));
    }

    static fromBuffer(buffer) {
      return deserialize(CounterSchema, Counter, buffer);
    }
  }

  const CounterSchema = new Map([
    [Counter, { kind: 'struct', fields: [['count', 'u64']] }],
  ]);

  it('Initialize the counter!', async () => {
    const lamports =
      await connection.getMinimumBalanceForRentExemption(COUNTER_ACCOUNT_SIZE);

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

    const accountInfo = await connection.getAccountInfo(
      counterAccount.publicKey,
    );
    expect(accountInfo).to.not.be.null;
    const counter = deserialize({ struct: { count: 'u64' } }, accountInfo.data);
    expect(counter.count).to.equal(0n);
    console.log('Counter initialized with count:', counter.count);
  });

  it('Increment the counter!', async () => {
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

    const accountInfo = await connection.getAccountInfo(
      counterAccount.publicKey,
    );
    expect(accountInfo).to.not.be.null;
    const counter = deserialize({ struct: { count: 'u64' } }, accountInfo.data);
    expect(counter.count).to.equal(1n);
    console.log('Counter incremented to:', counter.count);
  });
});
