import type { Cell } from '@ckb-lumos/base'
import { LiquidityAddReq } from './liquidityAddReq'
import { Lpt } from './lpt'
import { Sudt } from './sudt'
import { Ckb } from './ckb'

/*
this res contains 2 cell
1. liquidity cell which contains liquidity
2. change cell which contains remaining ckb or sudt
 */
export class LiquidityAddRes {

  // for liquidity cell
  lptAmount: bigint;

  // for change cell's ckb change, not include capacity for hold 2 cells
  ckbChangeAmount: bigint;
  sudtChangeAmount: bigint

  changeType: 'sudt' | 'ckb' | 'unknown'

  request : LiquidityAddReq;


  constructor(request:LiquidityAddReq) {
    this.request = request;
    this.lptAmount = 0n
    this.ckbChangeAmount = 0n
    this.sudtChangeAmount = 0n
    this.changeType = 'unknown'
  }

  static validate(_cell:Cell){
    return true;
  }

  toCells() : [Lpt,Sudt|Ckb]{
    const lpt = new Lpt()
    lpt.originalUserLock = this.request.originalUserLock
    lpt.capacity = Lpt.LPT_FIXED_CAPACITY
    lpt.lptAmount = this.lptAmount

    let sudtOrCkb : Sudt|Ckb
    if(this.changeType === 'sudt'){
      if(this.ckbChangeAmount !== 0n){
        throw new Error('this.ckbChangeAmount should be 0n')
      }

      let sudt = new Sudt()
      sudt.originalUserLock = this.request.originalUserLock
      sudt.capacity = Sudt.SUDT_FIXED_CAPACITY
      sudt.sudtAmount = this.sudtChangeAmount

      sudtOrCkb = sudt
    }
    else if(this.changeType === 'ckb'){
      if(this.sudtChangeAmount !== 0n){
        throw new Error('this.sudtChangeAmount should be 0n')
      }

      let ckb = new Ckb()
      ckb.originalUserLock = this.request.originalUserLock
      ckb.capacity = this.ckbChangeAmount
      sudtOrCkb = ckb
    }
    else{
      throw new Error('liquidityAddRes.changeType should not be unknown')
    }

    return [lpt,sudtOrCkb]
  }
}
