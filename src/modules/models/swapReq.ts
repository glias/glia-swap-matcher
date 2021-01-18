import type { Cell } from '@ckb-lumos/base'
import { changeHexEncodeEndian, leHexToBigInt } from '../../utils/tools'

/*
define SWAP_ORDER_LOCK_CODE_HASH
define SWAP_ORDER_CAPACITY = 188 * 10^8

enum order_type {
    sell
    buy
}

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: sudt_type - 65 bytes
lock: - 99 bytes
    code: SWAP_ORDER_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32) | version (u8, 1 byte, 32..33)
          | amount_in (u128, 16 bytes, 33..49) | min_amount_out (u128, 16 bytes, 49..65)
          | order_type (u8, 1 byte, 65..66)  - 32+1+16+16+1 = 66 bytes
 */
// note that the capacity is fixed to WAP_ORDER_CAPACITY = 155 * 10^8
export class SwapReq{
  static SWAP_REQUEST_FIXED_CAPACITY = 155 * 10^8

  capacity: bigint;
  sudtAmount: bigint;
  userLockHash: string
  version: string;


  swapType: 'buy' | 'sell'

  // for buy, sudtChangeAmount -> ckb
  sudtIn : bigint
  ckbOut : bigint// for result
  ckbOutMin : bigint

  //for sell, ckb -> sudtChangeAmount
  ckbIn : bigint
  sudtOut: bigint// for result
  sudtOutMin: bigint

  outPoint: string

  originalUserLock: CKBComponents.Script
  readonly rawCell:Cell;

  constructor(cell:Cell, script:CKBComponents.Script) {
    this.capacity = BigInt(cell.cell_output.capacity);
    this.sudtAmount = leHexToBigInt(cell.data);

    const args = cell.cell_output.lock.args.substring(2)
    this.userLockHash = changeHexEncodeEndian(args.substring(0,64))
    this.version = args.substring(64,66)

    const swap_type = args.substring(130,132)
    if(swap_type == '0x00'){
      this.swapType = 'sell';

      this.ckbIn = leHexToBigInt(args.substring(66,98))
      this.sudtOutMin = leHexToBigInt(args.substring(98,130))
      this.sudtOut = 0n

      this.sudtIn = 0n
      this.ckbOutMin = 0n
      this.ckbOut = 0n
    }else if(swap_type == '0x01'){
      this.swapType = 'buy';

      this.sudtIn = leHexToBigInt(args.substring(66,98))
      this.ckbOutMin = leHexToBigInt(args.substring(98,130))
      this.ckbOut = 0n

      this.ckbIn = 0n
      this.sudtOutMin = 0n
      this.sudtOut = 0n

    }else{
      this.swapType = 'sell'

      this.ckbIn = 0n
      this.sudtOutMin = 0n
      this.sudtOut = 0n
      this.sudtIn = 0n
      this.ckbOutMin = 0n
      this.ckbOut = 0n
    }
    this.outPoint = `${cell.out_point!.tx_hash}-${cell.out_point!.index}`
    this.originalUserLock = script
    this.rawCell = cell
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
