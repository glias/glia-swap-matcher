import type { Cell } from '@ckb-lumos/base'
import { LiquidityRemoveReq } from './liquidityRemoveReq'
import { Sudt } from './sudt'

// Sudt cell to contain both sudtChangeAmount and ckb
export class LiquidityRemoveRes {

  sudtAmount: bigint;
  capacityAmount: bigint;

  request : LiquidityRemoveReq;

  constructor(request:LiquidityRemoveReq) {
    this.request = request;
    this.sudtAmount = 0n
    this.capacityAmount = 0n
  }

  static validate(_cell:Cell){
    return true;
  }

  toCell() :Sudt{
    const sudt = new Sudt()
    sudt.capacity = this.capacityAmount
    sudt.sudtAmount = this.sudtAmount
    return sudt
  }
}
