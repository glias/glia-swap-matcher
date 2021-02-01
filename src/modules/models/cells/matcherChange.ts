import { Cell, OutPoint } from '@ckb-lumos/base'
import { Uint64BigIntToHex } from '../../../utils/tools'
import { CellOutputType } from './interfaces/CellOutputType'
import { CellInputType } from './interfaces/CellInputType'
import { BLOCK_MINER_FEE, MATCHER_LOCK_SCRIPT } from '../../../utils/envs'
import { Ckb } from './ckb'
import JSONbig from 'json-bigint'

// for tips, matcherChange only hold ckbs
// thought matcherChange is as same as Ckb, we give it a special class
/*
define MATCHER_CAPACITY = 73 * 10^8

capacity: - 8 bytes
data: amount: null
type: - null
lock: user_lock 65
 */
export class MatcherChange implements CellInputType, CellOutputType {
  static MATCHER_CHANGE_FIXED_CAPACITY = BigInt(73 * 10 ** 8)

  capacity: bigint

  outPoint: OutPoint

  constructor(cell: Cell) {
    this.capacity = BigInt(cell.cell_output.capacity)

    this.outPoint = cell.out_point!
  }

  reduceBlockMinerFee = () => {
    this.capacity -= BLOCK_MINER_FEE

    this.capacity = this.capacity < Ckb.CKB_FIXED_MIN_CAPACITY ? Ckb.CKB_FIXED_MIN_CAPACITY : this.capacity
  }

  static validate(cell: Cell): boolean {
    if (cell.data !== '0x') {
      return false
    }

    if (!cell.out_point) {
      return false
    }

    return true
  }

  static fromCell(cell: Cell): MatcherChange | null {
    if (!MatcherChange.validate(cell)) {
      return null
    }

    return new MatcherChange(cell)
  }

  static cloneWith(matcherChange: MatcherChange, txHash: string, index: string): MatcherChange {
    matcherChange = JSONbig.parse(JSONbig.stringify(matcherChange))
    matcherChange.outPoint.tx_hash = txHash
    matcherChange.outPoint.index = index
    return matcherChange
  }

  toCellInput(): CKBComponents.CellInput {
    return {
      previousOutput: {
        txHash: this.outPoint.tx_hash,
        index: this.outPoint.index,
      },
      since: '0x0',
    }
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToHex(this.capacity),
      type: null,
      lock: MATCHER_LOCK_SCRIPT,
    }
  }

  toCellOutputData(): string {
    return `0x`
  }

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
  }
}
