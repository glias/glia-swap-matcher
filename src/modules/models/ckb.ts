
// though a cell only carries ckb is a universal cell, we give it a class
// capacity 8 bytes
// lock script 65 scripts
export class Ckb{

  static CKB_FIXED_CAPACITY = BigInt(73 * 10^8)

  capacity: bigint =0n
  originalUserLock?: CKBComponents.Script

  constructor() {

  }

  toCellData() : string{
    return `0x`
  }
}
