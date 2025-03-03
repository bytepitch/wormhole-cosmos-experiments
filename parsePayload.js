function deserializePayload3(payloadBytes) {
  const dataView = new DataView(payloadBytes.buffer);
  let offset = 2;

  // Read Payload ID (1 byte)
  const payloadId = dataView.getUint8(offset);
  offset += 2;

  if (payloadId !== 3) {
    throw new Error("Invalid payload type. Expected 3.");
  }

  // Skip 24 reserved bytes
  offset += 24;

  // Read Amount (8 bytes, Big Endian)
  const amount = Number(dataView.getBigUint64(offset, false));
  offset += 8;

  // Read Token Address (32 bytes)
  const tokenAddr = payloadBytes.slice(offset, offset + 32);
  offset += 32;

  // Read Token Chain ID (2 bytes, Big Endian)
  const tokenChain = dataView.getUint16(offset, false);
  offset += 2;

  // Read Recipient Address (32 bytes)
  const recipientAddr = payloadBytes.slice(offset, offset + 32);
  offset += 32;

  // Read Recipient Chain ID (2 bytes, Big Endian)
  const recipientChain = dataView.getUint16(offset, false);
  offset += 2;

  // Read From Address (32 bytes)
  const fromAddr = payloadBytes.slice(offset, offset + 32);
  offset += 32;

  // Remaining bytes are the contract payload
  const contractPayloadBytes = payloadBytes.slice(offset),
    contractPayloadString = new TextDecoder().decode(contractPayloadBytes);

  let contractPayload;
  try {
    contractPayload = JSON.parse(contractPayloadString); // Parse JSON
  } catch (e) {
    contractPayload = contractPayloadString; // Return raw if not valid JSON
  }

  return {
    payloadId,
    amount,
    tokenAddr: Buffer.from(tokenAddr).toString("hex"),
    tokenChain,
    recipientAddr: Buffer.from(recipientAddr).toString("hex"),
    recipientChain,
    fromAddr: Buffer.from(fromAddr).toString("hex"),
    contractPayload,
  };
}

const paylaod =
    "03000000000000000000000000000000000000000000000000000000000bebc200069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f000000000010001c2e72b7bb32bfe2a3a4960e384e8c53d7a7c4a6c3b43b12f7f0e01532f3dea8d0c2094f6dddf3210f34fb8e81d95d74cf61c6306785531e83ab9f48f1fe532a88c8c7b22676174657761795f7472616e73666572223a7b22636861696e223a32302c22726563697069656e74223a2262334e74627a467364324d314f48466d626e6435593363354f54426a646e45776557566d626d707863585a715a32466b62486c68654752774e673d3d222c22666565223a2230222c226e6f6e6365223a37373939327d7d",
  // Example usage
  examplePayload = Buffer.from(paylaod, "hex");

console.log(deserializePayload3(examplePayload));
