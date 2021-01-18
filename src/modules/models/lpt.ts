import { bigIntTo128LeHex, } from '../../utils/tools'

/*
define LPT_CAPACITY = 154 * 10^8

capacity: - 8 bytes
data: amount: u128
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock
 */
// though LPT is a specific type of SUDT, we give it a unique class to represent
// and note that the capacity is fixed to SUDT_CAPACITY = 154 * 10^8
export class Lpt {
  static LPT_FIXED_CAPACITY = BigInt(154 * 10^8)

  lptAmount: bigint = 0n
  capacity: bigint = Lpt.LPT_FIXED_CAPACITY

  originalUserLock?: CKBComponents.Script

  constructor() {
  }
  toCellData() : string{
    return `0x${bigIntTo128LeHex(this.lptAmount)}`
  }
}
