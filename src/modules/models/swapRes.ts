import type { Cell } from '@ckb-lumos/base'
import { SwapReq } from './swapReq'
import { Sudt } from './sudt'
import { Ckb } from './ckb'

/*
this only contains ckb or sudtChangeAmount

for contain sudtChangeAmount, you need at least Sudt.SUDT_CAPACITY capacity
 */
export class SwapRes{

  capacity: bigint;
  sudtAmount: bigint;

  request :SwapReq;

  constructor(request :SwapReq) {
    this.capacity = 0n
    this.sudtAmount = 0n
    this.request = request
  }

  static validate(_cell:Cell){
    return true;
  }

  toCell() :Sudt|Ckb{
    if(this.sudtAmount === 0n){
      // compose Ckb
      const ckb = new Ckb()
      ckb.capacity = this.capacity
      ckb.originalUserLock = this.request.originalUserLock
      return ckb
    }else{
      // compose Sudt
      const sudt = new Sudt()
      sudt.sudtAmount = this.sudtAmount
      sudt.originalUserLock = this.request.originalUserLock
      return sudt
    }

  }
}
