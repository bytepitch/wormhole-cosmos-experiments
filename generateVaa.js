export function createPayload3(
  amount,
  tokenAddr,
  tokenChain,
  recipient,
  recipientChain,
  from,
  contractPayload,
) {
  const payload = new Uint8Array(
    1 + 24 + 8 + 32 + 2 + 32 + 2 + from.length + contractPayload.length,
  );
  let offset = 0;

  payload[offset] = 3; // Payload ID (1 byte)
  offset += 1;

  payload.set(new Uint8Array(24), offset); // Reserved bytes (24 bytes)
  offset += 24;

  new DataView(payload.buffer).setBigUint64(offset, BigInt(amount), false); // Amount (8 bytes, BigEndian)
  offset += 8;

  payload.set(tokenAddr, offset); // Token Address (32 bytes)
  offset += 32;

  new DataView(payload.buffer).setUint16(offset, tokenChain, false); // Token Chain ID (2 bytes)
  offset += 2;

  payload.set(recipient, offset); // Recipient Address (32 bytes)
  offset += 32;

  new DataView(payload.buffer).setUint16(offset, recipientChain, false); // Recipient Chain ID (2 bytes)
  offset += 2;

  payload.set(from, offset); // From Address (32 bytes)
  offset += from.length;

  payload.set(contractPayload, offset); // Contract Payload
  offset += contractPayload.length;

  return payload;
}

// // Example input values
// Const amount = 1000000000; // Example amount
// Const tokenAddr = new Uint8Array(32).fill(1); // solana contract universal address
// Const tokenChain = 1; // solana chain id
// Const recipient = new Uint8Array(32).fill(2); // Recipient addr is ibc translator
// Const recipientChain = 3104; // Wormchain id
// Const from = new Uint8Array(32).fill(3); // External address

// // Encode contract payload
// Const contractPayloadObj = {
//     Gateway_transfer_foo: {
//         Foo: "bar"
//     }
// };
// Const contractPayloadString = JSON.stringify(contractPayloadObj);
// Const contractPayload = new TextEncoder().encode(contractPayloadString);

// // Generate the full payload
// Const payloadBytes = createPayload3(amount, tokenAddr, tokenChain, recipient, recipientChain, from, contractPayload);
// // console.log(Buffer.from(payloadBytes).toString("hex")); // Print as hex string
