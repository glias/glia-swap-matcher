import {  Uint128BigIntToLeHex, Uint64BigIntToLeHex } from '../../../utils/tools'
import { CellOutputType } from './interfaces/CellOutputType'
import { LPT_TYPE_SCRIPT } from '../../../utils'

// though LPT is a specific type of SUDT, we give it a unique class to represent
// and note that the capacity is fixed to SUDT_CAPACITY = 154 * 10^8
/*
define LPT_CAPACITY = 154 * 10^8

capacity: - 8 bytes
data: amount: u128
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock
 */
export class Lpt implements CellOutputType {
  static LPT_FIXED_CAPACITY = BigInt(154 * 10 ^ 8)

  lptAmount: bigint = 0n
  capacity: bigint = Lpt.LPT_FIXED_CAPACITY
  originalUserLock: CKBComponents.Script

  constructor(lptAmount: bigint, originalUserLock: CKBComponents.Script) {
    this.lptAmount = lptAmount
    this.capacity = Lpt.LPT_FIXED_CAPACITY
    this.originalUserLock = originalUserLock
  }

  static from(lptAmount: bigint, originalUserLock: CKBComponents.Script): Lpt {
    return new Lpt(lptAmount, originalUserLock)
  }


  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToLeHex(this.capacity),
      type: LPT_TYPE_SCRIPT,
      lock: this.originalUserLock,
    }
  }

  toCellOutputData(): string {
    return `0x${Uint128BigIntToLeHex(this.lptAmount)}`
  }
}
