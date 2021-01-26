import { Cell, OutPoint } from '@ckb-lumos/base'
import {
  changeHexEncodeEndian,
  leHexToBigIntUint128,
  remove0xPrefix,
  scriptHash,
  Uint128BigIntToLeHex,
  Uint64BigIntToLeHex,
} from '../../../utils/tools'
import {
  INFO_LOCK_SCRIPT,
  INFO_LOCK_SCRIPT_HASH,
  INFO_TYPE_SCRIPT,
  INFO_TYPE_SCRIPT_HASH,
  LPT_TYPE_SCRIPT_HASH,
} from '../../../utils/envs'
import { CellOutputType } from './interfaces/CellOutputType'
import { CellInputType } from './interfaces/CellInputType'

/*
define INFO_TYPE_CODE_HASH
define INFO_LOCK_CODE_HASH
define INFO_CAPACITY = 250 * 10^8

capacity: - 8 bytes
data: - 80 bytes
    ckb_reserve: u128 16 bytes
    sudt_reserve: u128
    total_liquidity: u128
    liquidity_sudt_type_hash: 32 bytes
type: - 65 bytes
    code: INFO_TYPE_CODE_HASH - 32 bytes + 1 byte
    args: id - 32 bytes
lock: - 97 bytes
    code: INFO_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: hash(ckb | asset_sudt_type_hash) 32 bytes | info_type_hash - 32 bytes
 */
export class Info implements CellInputType, CellOutputType {
  static INFO_FIXED_CAPACITY = BigInt((250 * 10) ^ 8)
  // this should be fixed
  capacity: bigint /*= Info.INFO_IFXED_CAPACITY*/

  ckbReserve: bigint
  sudtReserve: bigint
  totalLiquidity: bigint
  // we don't care liquidity_sudt_type_hash_32
  // we don't care args of type script and lock script cause it keep at runtime

  // keep the txHash to trace the Info cell
  outPoint: OutPoint

  constructor(cell: Cell) {
    const args = cell.data.substring(2)
    this.capacity = BigInt(cell.cell_output.capacity)

    this.ckbReserve = leHexToBigIntUint128(args.substring(0, 32))
    this.sudtReserve = leHexToBigIntUint128(args.substring(32, 64))
    this.totalLiquidity = leHexToBigIntUint128(args.substring(64, 96))

    this.outPoint = cell.out_point!
  }

  static validate(cell: Cell): boolean {
    if (BigInt(cell.cell_output.capacity) !== Info.INFO_FIXED_CAPACITY) {
      return false
    }
    // for liquidity_sudt_type_hash field in data
    if (changeHexEncodeEndian(cell.data.substring(2).substring(96, 160)) !== LPT_TYPE_SCRIPT_HASH) {
      return false
    }
    if (scriptHash(cell.cell_output.type!) !== INFO_TYPE_SCRIPT_HASH) {
      return false
    }

    if (scriptHash(cell.cell_output.lock) !== INFO_LOCK_SCRIPT_HASH) {
      return false
    }

    if (!cell.out_point) {
      return false
    }

    return true
  }

  static fromCell(cell: Cell): Info | null {
    if (!Info.validate(cell)) {
      return null
    }

    return new Info(cell)
  }

  static cloneWith(info: Info, txHash: string, index: string): Info {
    info = JSON.parse(JSON.stringify(info))
    info.outPoint.tx_hash = txHash
    info.outPoint.index = index
    return info
  }

  toCellInput(): CKBComponents.CellInput {
    return {
      previousOutput: {
        txHash: this.outPoint.tx_hash,
        index: this.outPoint.index,
      },
      since: '0x00',
    }
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToLeHex(this.capacity),
      type: INFO_TYPE_SCRIPT,
      lock: INFO_LOCK_SCRIPT,
    }
  }

  toCellOutputData(): string {
    return `0x${Uint128BigIntToLeHex(this.ckbReserve)}${Uint128BigIntToLeHex(this.sudtReserve)}${Uint128BigIntToLeHex(
      this.sudtReserve,
    )}${remove0xPrefix(changeHexEncodeEndian(LPT_TYPE_SCRIPT_HASH))}`
  }

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
  }
}
