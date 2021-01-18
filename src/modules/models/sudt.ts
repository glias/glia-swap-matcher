import { bigIntTo128LeHex } from '../../utils/tools'

/*
define SUDT_CAPACITY = 154 * 10^8

capacity: - 8 bytes
data: amount: u128 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock 65
 */
export class Sudt {
  static SUDT_FIXED_CAPACITY = BigInt(154 * 10^8)

  sudtAmount: bigint = 0n
  capacity: bigint =Sudt.SUDT_FIXED_CAPACITY

  originalUserLock?: CKBComponents.Script

  constructor() {
  }
  toCellData() : string{
    return `0x${bigIntTo128LeHex(this.sudtAmount)}`
  }
}
