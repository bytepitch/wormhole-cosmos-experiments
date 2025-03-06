import {
  SignatureUtils,
  Signature,
  keccak256,
  createVAA,
  UniversalAddress,
  serializeLayout,
} from '@wormhole-foundation/sdk';

/**
 * @typedef {import("@wormhole-foundation/sdk").UniversalAddress} UniversalAddress
 *
 * @typedef {{
 *   emitterAddress: UniversalAddress;
 *   emitterChain: string;
 * }} EmitterInfo
 *
 * @typedef {{
 *   tokenAddress: UniversalAddress;
 *   tokenChain: string;
 *   decimals: number;
 *   symbol: string;
 *   name: string;
 * }} AttestMetaPayloadInfo
 *
 * @typedef {{
 *   chain: string;
 *   contractAddress: UniversalAddress;
 * }} SetIbcMwPayloadInfo
 *
 * @typedef {{
 *   channelId: string;
 *   chainChannel: string;
 * }} UpdateChannelPayloadInfo
 *
 * @typedef  {{
 *   payloadId: number;
 *   fee: number;
 *   tokenAmount: number;
 *   tokenChain: string;
 *   tokenAddress: UniversalAddress;
 *   toChain: string;
 *   toAddress: UniversalAddress;
 *   from: UniversalAddress;
 *   payload: Uint8Array
 * }} TransferWithPayloadPayloadInfo
 */

const config = {
  guardianSetIndex: 0,
  consistencyLevel: 0,
  guardianKey:
    'cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0',
};

const registerTokenBridgeToAccountantLayout = () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return [
    {
      name: 'module',
      binary: 'bytes',
      size: 32,
      custom: {
        from: (val) => encoder.encode(val.padStart(32, '\0')),
        to: (val) => decoder.decode(val),
      },
    },
    { name: 'type', binary: 'uint', size: 1 },
    { name: 'chain', binary: 'uint', size: 2 },
    { name: 'emitterChain', binary: 'uint', size: 2 },
    {
      name: 'emitterAddress',
      binary: 'bytes',
      size: 32,
      custom: {
        to: (val) => new UniversalAddress(val),
        from: (val) => val.toUint8Array(),
      },
    },
  ];
};

export const addSignature = (guardianKey, vaa) => {
  const signature = SignatureUtils.sign(guardianKey, keccak256(vaa.hash));
  const s = new Signature(signature.r, signature.s, signature.recovery);

  vaa.signatures.push({ guardianIndex: 0, signature: s });
};

const random = () => Math.floor(Math.random() * 10_000_00);

const padString = (rawString) => rawString.padEnd(32, '\0');

/**
 *
 * @param {EmitterInfo} emitterInfo
 */
export const getCommonVAAInfo = (emitterInfo, prevSequence = undefined) => {
  const commons = {
    guardianSet: config.guardianSetIndex,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: random(),
    emitterChain: emitterInfo.emitterChain,
    emitterAddress: emitterInfo.emitterAddress,
    sequence: prevSequence ? prevSequence + 1 : random(),
    consistencyLevel: config.consistencyLevel,
    signatures: [],
  };

  return commons;
};

/**
 *
 * @param {EmitterInfo} emitterInfo
 * @param {AttestMetaPayloadInfo} payloadInfo
 * @param {boolean} [sign]
 */
export const createAttestMetaVAA = (emitterInfo, payloadInfo, sign = false) => {
  const commons = getCommonVAAInfo(emitterInfo);
  const vaa = createVAA('TokenBridge:AttestMeta', {
    ...commons,
    payload: {
      token: {
        address: payloadInfo.tokenAddress,
        chain: payloadInfo.tokenChain,
      },
      decimals: payloadInfo.decimals,
      symbol: padString(payloadInfo.symbol),
      name: padString(payloadInfo.name),
    },
  });

  if (sign) {
    addSignature(config.guardianKey, vaa);
  }

  return vaa;
};

/**
 *
 * @param {EmitterInfo} emitterInfo
 * @param {SetIbcMwPayloadInfo} payloadInfo
 */
export const createSetMwVAA = (emitterInfo, payloadInfo, sign = false) => {
  const commons = getCommonVAAInfo(emitterInfo);
  const vaa = createVAA('GatewayGovernance:SetIbcComposabilityMwContract', {
    ...commons,
    payload: {
      chain: payloadInfo.chain,
      actionArgs: {
        contractAddress: payloadInfo.contractAddress,
      },
    },
  });

  if (sign) {
    addSignature(config.guardianKey, vaa);
  }

  return vaa;
};

/**
 *
 * @param {EmitterInfo} emitterInfo
 * @param {UpdateChannelPayloadInfo} payloadInfo
 * @param {boolean} sign
 */
export const createUpdateChannelVAA = (
  emitterInfo,
  payloadInfo,
  sign = false,
) => {
  const commons = getCommonVAAInfo(emitterInfo);
  const vaa = createVAA('IbcBridge:ActionUpdateChannelChain', {
    ...commons,
    payload: {
      chain: 'Wormchain',
      actionArgs: {
        channelId: payloadInfo.channelId,
        channelChain: payloadInfo.channelChain,
      },
    },
  });

  if (sign) {
    addSignature(config.guardianKey, vaa);
  }

  return vaa;
};

/**
 *
 * @param {EmitterInfo} emitterInfo
 * @param {TransferWithPayloadPayloadInfo} payloadInfo
 * @param {boolean} sign
 */
export const createTransferWithPayloadVAA = (
  emitterInfo,
  payloadInfo,
  sign,
) => {
  const {
    fee,
    tokenAddress,
    tokenAmount,
    tokenChain,
    toAddress,
    toChain,
    from,
    payload,
    payloadId,
  } = payloadInfo;

  const commons = getCommonVAAInfo(emitterInfo);
  const vaa = createVAA('TokenBridge:TransferWithPayload', {
    ...commons,
    payload: {
      payloadId,
      fee,
      token: {
        amount: tokenAmount,
        address: tokenAddress,
        chain: tokenChain,
      },
      to: {
        chain: toChain,
        address: toAddress,
      },
      from,
      payload,
    },
  });

  if (sign) {
    addSignature(config.guardianKey, vaa);
  }

  return vaa;
};

/**
 *
 * @param {EmitterInfo} emitterInfo
 * @param {UniversalAddress} emitterContractAddr
 * @param {boolean} sign
 */
export const createRegisterWormchainToAccountantVAA = (
  emitterInfo,
  emitterContractAddr,
  sign = true,
) => {
  const commons = getCommonVAAInfo(emitterInfo);

  const myCustomPayload = {
    module: 'TokenBridge', // Informs the accountant that this is TB operation
    type: 1, // Corresponds to 'RegisterChain'
    emitterChain: 3104, // Id of the chain we are letting emit transfer events
    chain: 0, // 0 means this VAA is a generic purpose one, not so important for us atm
    emitterAddress: emitterContractAddr, // Address that accountant will let emit transfer events, for our case it is TokenBridge wasm contract deployed on Wormchain
  };

  const vaa = createVAA('Uint8Array', {
    ...commons,
    payload: serializeLayout(
      registerTokenBridgeToAccountantLayout(),
      myCustomPayload,
    ),
  });

  if (sign) {
    addSignature(config.guardianKey, vaa);
  }

  return vaa;
};
