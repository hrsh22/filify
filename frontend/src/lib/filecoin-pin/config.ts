import type { SynapseSetupConfig } from 'filecoin-pin/core/synapse'
import {
  FILECOIN_PRIVATE_KEY,
  FILECOIN_RPC_URL,
  WARM_STORAGE_ADDRESS,
} from '@/utils/constants'

export const filecoinPinConfig: SynapseSetupConfig = {
  privateKey: FILECOIN_PRIVATE_KEY!,
  rpcUrl: FILECOIN_RPC_URL,
  warmStorageAddress: WARM_STORAGE_ADDRESS,
}
