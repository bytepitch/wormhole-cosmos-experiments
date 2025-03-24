import { PublicKey, Connection } from '@solana/web3.js';
import {
  getGuardianSet,
  getWormholeBridgeData,
} from '@certusone/wormhole-sdk/lib/cjs/solana/wormhole/index.js';

export const LOCAL_RPC = 'http://localhost:8899';

/**
 * From https://github.com/wormhole-foundation/wormhole/blob/df918bb5277cbef62d2678f3a0ef9a62ee685e4e/sdk/js/src/solana/utils/account.ts#L15
 */
export function deriveAddress(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, new PublicKey(programId))[0];
}

export const main = async () => {
  const connection = new Connection(LOCAL_RPC, 'confirmed');
  const bridgeId = new PublicKey('Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o');
  const info = await getWormholeBridgeData(connection, bridgeId);
  console.log(info);
  const myGuardianSet = await getGuardianSet(connection, bridgeId, 0);
  console.log('MY_GUARD_SET', myGuardianSet);
  const myKey = new PublicKey(myGuardianSet.keys.at(0)).toString();
  console.log(myKey);
};

main().catch(err => console.log('ERR', err));
