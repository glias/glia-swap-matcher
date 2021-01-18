import { Cell } from '@ckb-lumos/base'
import { bigIntTo128LeHex, leHexToBigInt } from '../../utils/tools'


/*
define MATCHER_CAPACITY = 154 * 10^8

capacity: - 8 bytes
data: amount: u128 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock 65
 */
export class MatcherChange {
  static MATCHER_CHANGE_FIXED_CAPACITY =  BigInt(154 * 10^8)

  sudtAmount: bigint
  capacity: bigint

  readonly rawCell: Cell

  constructor(cell: Cell) {
    this.sudtAmount =  leHexToBigInt(cell.data)
    this.capacity =  BigInt(cell.cell_output.capacity)

    this.rawCell = cell
  }
  toCellData() : string{
    return `0x${bigIntTo128LeHex(this.sudtAmount)}`
  }
}
