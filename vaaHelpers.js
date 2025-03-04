import {
  SignatureUtils,
  Signature,
  keccak256,
  createVAA,
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
 */

const config = {
  guardianSetIndex: 0,
  consistencyLevel: 0,
  guardianKey:
    'cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0',
};

export const addSignature = (guardianKey, vaa) => {
  const signature = SignatureUtils.sign(guardianKey, keccak256(vaa.hash));
  const s = new Signature(signature.r, signature.s, signature.recovery);

  vaa.signatures.push({ guardianIndex: 0, signature: s });
};

const random = () => Math.floor(Math.random() * 10_000_000);

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
