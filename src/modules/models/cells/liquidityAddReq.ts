import type { Cell } from '@ckb-lumos/base'
import { changeHexEncodeEndian, leHexToBigIntUint128, leHexToBigIntUint64, scriptHash } from '../../../utils/tools'
import { SUDT_TYPE_SCRIPT_HASH } from '../../../utils/envs'
import { CellInputType } from './interfaces/CellInputType'
import { OutPoint } from '@ckb-lumos/base'

/*
define LIQUIDITY_REQ_LOCK_CODE_HASH
define LIQUIDITY_REQ_CAPACITY = 235 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: asset_sudt_type - 65 bytes
lock: - 146 bytes
    code: LIQUIDITY_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32)
    | version (u8, 1 byte, 32..33)
    | sudtMin (u128, 16 bytes, 33..49)
    | ckbMin (u64, 8 bytes, 49..57)
    | info_type_hash_32 (32 bytes, 57..89)
    | tips (8 bytes, 89..97)
    | tips_sudt (16 bytes, 97..113)

 */
export class LiquidityAddReq implements CellInputType {
  static LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY = BigInt((235 * 10) ^ 8)

  // given sudt for add
  sudtAmount: bigint
  // given capacity for add, the ckb is in it, should be greater than LIQUIDITY_ADD_REQUEST_FIXED_CAPACITY
  capacityAmount: bigint

  public userLockHash: string

  version: string

  sudtMin: bigint

  ckbMin: bigint

  infoTypeHash: string

  tips: bigint
  tipsSudt: bigint

  originalUserLock: CKBComponents.Script

  outPoint: OutPoint

  constructor(cell: Cell, script: CKBComponents.Script) {
    this.sudtAmount = leHexToBigIntUint128(cell.data)
    this.capacityAmount = BigInt(cell.cell_output.capacity)

    const args = cell.cell_output.lock.args.substring(2)
    this.userLockHash = changeHexEncodeEndian(args.substring(0, 64))
    this.version = args.substring(64, 66)

    this.sudtMin = leHexToBigIntUint128(args.substring(66, 98))
    this.ckbMin = leHexToBigIntUint64(args.substring(98, 114))

    this.infoTypeHash = changeHexEncodeEndian(args.substring(114, 178))

    this.tips = leHexToBigIntUint64(args.substring(178, 194))
    this.tipsSudt = leHexToBigIntUint128(args.substring(194, 226))

    this.outPoint = cell.out_point!
    this.originalUserLock = script
  }

  static fromCell(cell: Cell, script: CKBComponents.Script): LiquidityAddReq | null {
    if (!LiquidityAddReq.validate(cell)) {
      return null
    }

    return new LiquidityAddReq(cell, script)
  }

  static validate(cell: Cell) {
    if (scriptHash(cell.cell_output.type!) != SUDT_TYPE_SCRIPT_HASH) {
      return false
    }
    if (BigInt(cell.cell_output.capacity) < LiquidityAddReq.LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY) {
      return false
    }

    if (!cell.out_point) {
      return false
    }

    return true
  }
  static getUserLockHash(cell: Cell): string {
    return changeHexEncodeEndian(cell.cell_output.lock.args.substring(2).substring(0, 64))
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

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
  }
}
