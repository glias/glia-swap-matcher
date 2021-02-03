/*
though a cell only carries ckb is a universal cell, we give it a class
capacity 8 bytes
lock script 65 scripts
type null
data null
*/
import { CellOutputType } from './interfaces/CellOutputType'
import { defaultScript, Uint64BigIntToHex } from '../../../utils/tools'

export class Ckb implements CellOutputType {
  static CKB_FIXED_MIN_CAPACITY = BigInt(73 * 10 ** 8)

  // the capacity, which is all the ckb_amount this cell holds
  capacity: bigint = 0n
  originalUserLock: CKBComponents.Script

  constructor(capacity: bigint, originalUserLock: CKBComponents.Script) {
    this.capacity = capacity
    this.originalUserLock = originalUserLock
  }

  static from(capacity: bigint, originalUserLock: CKBComponents.Script): Ckb {
    return new Ckb(capacity, originalUserLock)
  }

  static default(): Ckb {
    return new Ckb(0n, defaultScript)
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToHex(this.capacity),
      type: null,
      lock: this.originalUserLock,
    }
  }

  toCellOutputData(): string {
    return `0x`
  }
}
