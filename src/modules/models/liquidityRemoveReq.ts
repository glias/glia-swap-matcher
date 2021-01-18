import type { Cell } from '@ckb-lumos/base'
import { changeHexEncodeEndian, leHexToBigInt } from '../../utils/tools'

/*
define LIQUIDITY_ORDER_LOCK_CODE_HASH
define LIQUIDITY_ORDER_CAPACITY = 207 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: liquidity_sudt_type - 65 bytes
lock: - 118 bytes
    code: LIQUIDITY_ORDER_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32) | version (u8, 1 byte, 32..33)
    | amount0 (u128, 16 bytes, 33..49) | amount1 (u128, 16 bytes, 49..65)
    | info_type_hash_20 (20 bytes, 65..85)

 */
export class LiquidityRemoveReq {
  static LIQUIDITY_ADD_REQUEST_FIXED_CAPACITY = 207 * 10^8

  // given lpt to exchange
  lptAmount: bigint;

  capacityAmount: bigint;

  ckbOut:bigint =0n
  sudtOut:bigint =0n

  // for both add and remove
  ckbMin:bigint;
  sudtMin:bigint;

  userLockHash: string
  version: string;
  //info_type_hash should be same in runtime, we don't care it

  originalUserLock: CKBComponents.Script
  outPoint: string
  readonly rawCell:Cell;

  constructor(cell:Cell, script:CKBComponents.Script) {

    this.lptAmount = leHexToBigInt(cell.data);
    this.capacityAmount = BigInt(cell.cell_output.capacity);

    const args = cell.cell_output.lock.args.substring(2);
    this.userLockHash = changeHexEncodeEndian(args.substring(0,64));
    this.version = args.substring(64,66);

    this.ckbMin =  leHexToBigInt(args.substring(66,98));
    this.sudtMin =  leHexToBigInt(args.substring(98,130));

    this.outPoint = `${cell.out_point!.tx_hash}-${cell.out_point!.index}`
    this.originalUserLock = script
    this.rawCell = cell;
  }

  static validate(_cell:Cell){
    return true;
  }

  static getUserLockHash(cell:Cell) : string{
    return changeHexEncodeEndian(
      cell.cell_output.lock.args.substring(2)
        .substring(0,64))
  }
}
