import { Uint128BigIntToLeHex, Uint64BigIntToLeHex } from '../../../utils/tools'
import { CellOutputType } from './interfaces/CellOutputType'
import { SUDT_TYPE_SCRIPT } from '../../../utils/envs'

/*
define SUDT_CAPACITY = 154 * 10^8

capacity: - 8 bytes
data: amount: u128 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock 65
 */
export class Sudt implements CellOutputType {
  static SUDT_FIXED_CAPACITY = BigInt((154 * 10) ^ 8)

  sudtAmount: bigint = 0n
  capacity: bigint = Sudt.SUDT_FIXED_CAPACITY

  originalUserLock: CKBComponents.Script

  constructor(sudtAmount: bigint, originalUserLock: CKBComponents.Script) {
    this.sudtAmount = sudtAmount
    this.originalUserLock = originalUserLock
  }

  static from(sudtAmount: bigint, originalUserLock: CKBComponents.Script): Sudt {
    return new Sudt(sudtAmount, originalUserLock)
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToLeHex(this.capacity),
      type: SUDT_TYPE_SCRIPT,
      lock: this.originalUserLock,
    }
  }

  toCellOutputData(): string {
    return `0x${Uint128BigIntToLeHex(this.sudtAmount)}`
  }
}
