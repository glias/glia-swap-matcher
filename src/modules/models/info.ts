import { Cell } from '@ckb-lumos/base'
import { bigIntTo128LeHex, leHexToBigInt } from '../../utils/tools'
import { LPT_TYPE_SCRIPT_HASH } from '../../utils'

/*
define INFO_TYPE_CODE_HASH
define INFO_LOCK_CODE_HASH
define INFO_CAPACITY = 214 * 10^8

capacity: - 8 bytes
data: - 68 bytes
    ckb_reserve: u128
    sudt_reserve: u128
    total_liquidity: u128
    liquidity_sudt_type_hash_20: 20 bytes
type: - 65 bytes
    code: INFO_TYPE_CODE_HASH - 32 bytes + 1 byte
    args: id - 32 bytes
lock: - 73 bytes
    code: INFO_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: hash(ckb | asset_sudt_type_hash) | info_type_hash - 20 bytes | 20 bytes
 */
export class Info {
  static INFO_IFXED_CAPACITY = BigInt(214 * 10^8)
  // this should be fixed
  capacity: bigint /*= Info.INFO_IFXED_CAPACITY*/

  ckbReserve: bigint
  sudtReserve: bigint
  totalLiquidity: bigint
  // we don't care liquidity_sudt_type_hash_20
  // we don't care args of type script and lock script cause it keep at runtime

  txHash: string

  rawCell: Cell

  constructor(cell: Cell) {
    const args = cell.data.substr(2)
    this.capacity =  BigInt(cell.cell_output.capacity)

    this.ckbReserve = leHexToBigInt(args.substring(0, 32))
    this.sudtReserve = leHexToBigInt(args.substring(32, 64))
    this.totalLiquidity = leHexToBigInt(args.substring(64, 96))

    this.txHash = cell.out_point?.tx_hash!
    this.rawCell =cell
  }

  toCellData() : string{
    return `0x${bigIntTo128LeHex(this.ckbReserve)}${bigIntTo128LeHex(this.sudtReserve)}${bigIntTo128LeHex(this.sudtReserve)}${LPT_TYPE_SCRIPT_HASH}`
  }
}
