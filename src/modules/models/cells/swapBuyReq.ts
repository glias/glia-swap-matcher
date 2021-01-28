import type { Cell } from '@ckb-lumos/base'
import { leHexToBigIntUint128, leHexToBigIntUint64, prepare0xPrefix } from '../../../utils/tools'
import { CellInputType } from './interfaces/CellInputType'
import { OutPoint } from '@ckb-lumos/base'

/*
define SWAP_ORDER_LOCK_CODE_HASH
define SWAP_ORDER_CAPACITY = 188 * 10^8

enum order_type {
    sell
    buy
}

define SWAP_REQ_LOCK_CODE_HASH
define SWAP_REQ_CAPACITY_SELL = 227 * 10^8
define SWAP_REQ_CAPACITY_BUY = 146 * 10^8

enum swap_request_type {
    sell
    buy
}

capacity: - 8 bytes
data: - null for buy
type: null for buy - 0 bytes
lock: - 138 bytes
    code: SWAP_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32)
     | version (u8, 1 byte, 32..33)
     | amountOutMin (u128, 16 bytes, 33..49)
     | sudt_type_hash (32 bytes, 49..81)
     | tips (8 bytes, 81..89)
     | tips_sudt (16 bytes, 89..105)
 */
// note that the capacity is fixed to WAP_ORDER_CAPACITY = 155 * 10^8
export class SwapBuyReq implements CellInputType {
  static SWAP_BUY_REQUEST_FIXED_CAPACITY = BigInt(146 * 10 ** 8)

  // spend ckbs in capacity to buy sudt
  capacity: bigint
  public userLockHash: string
  version: string
  amountOutMin: bigint
  sudtTypeHash: string
  tips: bigint
  tips_sudt: bigint

  originalUserLock: CKBComponents.Script
  outPoint: OutPoint

  constructor(cell: Cell, script: CKBComponents.Script) {
    this.capacity = BigInt(cell.cell_output.capacity)

    const args = cell.cell_output.lock.args.substring(2)
    this.userLockHash = args.substring(0, 64)
    this.version = args.substring(64, 66)
    this.amountOutMin = leHexToBigIntUint128(args.substring(66, 98))
    this.sudtTypeHash = args.substring(98, 162)
    this.tips = leHexToBigIntUint64(args.substring(162, 178))
    this.tips_sudt = leHexToBigIntUint128(args.substring(178, 210))

    this.outPoint = cell.out_point!
    this.originalUserLock = script
  }

  static validate(cell: Cell) {
    if (!cell.out_point) {
      return false
    }
    return true
  }

  static fromCell(cell: Cell, script: CKBComponents.Script): SwapBuyReq | null {
    if (!SwapBuyReq.validate(cell)) {
      return null
    }
    return new SwapBuyReq(cell, script)
  }

  static getUserLockHash(cell: Cell): string {
    return prepare0xPrefix(cell.cell_output.lock.args.substring(2).substring(0, 64))
  }

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
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
}
