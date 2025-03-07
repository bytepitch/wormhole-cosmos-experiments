import { Registry } from '@cosmjs/proto-signing';

import * as wasm from '@wormhole-foundation/wormchain-sdk/lib/modules/cosmwasm.wasm.v1/index.js';
import * as coreModule from '@wormhole-foundation/wormchain-sdk/lib/modules/wormhole_foundation.wormchain.wormhole/index.js';
import * as ibc from '@cosmjs/stargate/build/modules/ibc/messages.js';

const types = [
  ...wasm.registry.types,
  ...coreModule.registry.types,
  ...ibc.ibcTypes,
];

export const getRegistry = () => new Registry(types);
