import { Cell } from '@ckb-lumos/base'
import { bigIntTo128LeHex, leHexToBigInt } from '../../utils/tools'

/*
define POOL_FIXED_CAPACITY =  162 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount
type: sudt_type - 65 bytes
lock: info_lock - 73 bytes
 */
export class Pool{
  static POOL_FIXED_CAPACITY =  BigInt(162 * 10^8)

  capacity : bigint
  sudtAmount: bigint

  readonly rawCell:Cell;

  constructor(cell:Cell) {
    this.sudtAmount =  leHexToBigInt(cell.data)
    this.capacity =  BigInt(cell.cell_output.capacity)

    this.rawCell = cell
  }

  toCellData() : string{
    return `0x${bigIntTo128LeHex(this.sudtAmount)}`
  }

}
