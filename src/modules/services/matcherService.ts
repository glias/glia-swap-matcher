import { injectable } from 'inversify'
import { LiquidityRemoveReq } from '../models/liquidityRemoveReq'
import { Info } from '../models/info'
import { Pool } from '../models/pool'
import { Sudt } from '../models/sudt'
import { Ckb } from '../models/ckb'
import { SwapReq } from '../models/swapReq'
import { LiquidityAddReq } from '../models/liquidityAddReq'
import { LiquidityRemoveRes } from '../models/liquidityRemoveRes'
import { LiquidityAddRes } from '../models/liquidityAddRes'
import { MatcherChange } from '../models/matcherChange'
import { SwapRes } from '../models/swapRes'
import { Lpt } from '../models/lpt'


@injectable()
export default class MatcherService {


  constructor() {

  }

  /*
  info -> info
  pool -> pool
  matcherChange -> matcherChange
  [swapReq] -> [sudtChangeAmount/ckb]
   */
  matchSwap = (
    swapReqs:Array<SwapReq>,
    info:Info,
    pool:Pool,
    matcherChange:MatcherChange)
    : [Array<SwapRes>,Info,Pool,MatcherChange] => {

    let swapResults : Array<SwapRes> = []
    for(let swapReq of swapReqs){
      let res = this.calcSwapReq(swapReq,matcherChange,info,pool)
      if(!res){
        continue
      }
      let swapRes : SwapRes
      [swapRes,matcherChange,info,pool] = res

      // update SwapReq infomation into Sudt|Ckb

      swapResults.push(swapRes)
    }
    return [swapResults,info,pool,matcherChange]
  }

  /*
    1/1000's input ckb/sudtChangeAmount goes to matcher
    2/1000's input goes to pool
    user use 997/1000's input to do the swap actually
  */
  calcSwapReq = (swapReq:SwapReq, matcherChange:MatcherChange ,info:Info,pool:Pool)
    :[SwapRes,MatcherChange,Info,Pool]|null =>{
    let swapRes : SwapRes
    /*
    swap_order_cell  ->  ckb_cell
     */
    if(swapReq.swapType === 'buy'){
      // spend sudtChangeAmount to get ckb
      // sudtChangeAmount -> ckb

      // (sudt_reserve + spent_sudt * 99.7%)(ckb_reserve - ckb_got) <= sudt_reserve * ckb_reserve
      // sudt_reserve * - ckb_got + spent_sudt * 99.7% * ckb_reserve + spent_sudt * 99.7% * - ckb_got <=0
      // spent_sudt * 99.7% * ckb_reserve <= sudt_reserve * ckb_got + spent_sudt * 99.7% * ckb_got
      // spent_sudt * 99.7% * ckb_reserve <= (sudt_reserve + spent_sudt * 99.7% )* ckb_got
      // spent_sudt * 997 * ckb_reserve <= (sudt_reserve * 1000 + spent_sudt * 997 )* ckb_got
      // ckb_got >= spent_sudt * 997 * ckb_reserve / (sudt_reserve * 1000 + spent_sudt * 997 )

      let ckbOut : bigint = swapReq.sudtIn*997n*info.ckbReserve / (info.sudtReserve*1000n+  swapReq.sudtIn*997n)



      if(ckbOut < swapReq.ckbOutMin){
        return null
      }

      if((ckbOut + swapReq.capacity < Ckb.CKB_FIXED_CAPACITY)){
        // this shouldn't happen
        return null
      }
      swapReq.ckbOut = ckbOut

      // the matcher got 0.1% input, floor it
      let sudtProfit = swapReq.sudtAmount/1000n
      matcherChange.sudtAmount += sudtProfit

      // then all remaining sudtChangeAmount, include of 0.2% as liquidity provider interest, goes into pool
      info.sudtReserve += swapReq.sudtAmount - sudtProfit;
      info.ckbReserve -= ckbOut;

      pool.sudtAmount += swapReq.sudtAmount - sudtProfit;
      pool.capacity  -= ckbOut;

      // compose ckb
      swapRes = new SwapRes(swapReq)
      // transfer capacity to new cell
      swapRes.capacity = ckbOut + swapReq.capacity
      swapRes.sudtAmount = 0n
    }
    /*
      swap_order_cell  ->  sudt_cell
    */
    else{
      // spend ckb to get sudtChangeAmount
      // ckb -> sudtChangeAmount

      // since you can not spend all ckb because we need some to hold the output sudtChangeAmount cell
      if( swapReq.capacity -swapReq.ckbIn < Sudt.SUDT_FIXED_CAPACITY){
        return null
      }

      // the formula is as same as before :0
      // (ckb_reserve  + spent_ckb * 99.7% ) (sudt_reserve - sudt_got) <= sudt_reserve * ckb_reserve
      // ckb_reserve * - sudt_got + spent_ckb * 99.7% * sudt_reserve + spent_ckb * 99.7% * - sudt_got <=0
      // spent_ckb * 99.7% * sudt_reserve <= ckb_reserve * sudt_got + spent_ckb * 99.7% * sudt_got
      // spent_ckb * 99.7% * sudt_reserve <= (ckb_reserve + spent_ckb * 99.7% )* sudt_got
      // spent_ckb * 997 * sudt_reserve <= (ckb_reserve * 1000 + spent_ckb * 997 )* sudt_got
      // sudt_got >= spent_ckb * 997 * sudt_reserve / (ckb_reserve * 1000 + spent_ckb * 997 )

      let sudt_got = swapReq.ckbIn*997n*info.sudtReserve / (info.ckbReserve*1000n+  swapReq.ckbIn*997n)

      if(sudt_got < swapReq.sudtOutMin){
        return null
      }

      swapReq.sudtOut = sudt_got

      // the matcher got 0.1% input, floor it
      let ckb_profit = swapReq.ckbIn/1000n

      matcherChange.capacity += ckb_profit

      // then all ckb, include of 0.2% as liquidity provider interest, goes into pool
      info.ckbReserve += swapReq.ckbIn - ckb_profit
      info.sudtReserve -= sudt_got;

      pool.capacity += swapReq.ckbIn - ckb_profit
      pool.sudtAmount -= sudt_got;

      //compose sudt
      swapRes = new SwapRes(swapReq)
      swapRes.capacity = swapReq.capacity - swapReq.ckbIn
      swapRes.sudtAmount += sudt_got
    }

    return [swapRes,matcherChange,info,pool]
  }



  /*
  Info -> Info
  Pool -> Pool
  [removeReq] -> [removeRes(Sudt-cell)]
  [addReq] -> [addRes(Lpt-cell + Sudt-change-cell)]
   */
  matchLiquidity = (liquidityRemoveReqs : Array<LiquidityRemoveReq>,
                    liquidityAddReqs : Array<LiquidityAddReq>,
                    info:Info, pool:Pool, matcherChange:MatcherChange)
    :[Array<LiquidityRemoveRes>,Array<LiquidityAddRes>,Info,Pool,MatcherChange]=>{

    let removeResults : Array<LiquidityRemoveRes> = []
    for (let req of liquidityRemoveReqs){
      let removeRes : LiquidityRemoveRes
      let res =  this.calcRemoveReq(req,info,pool)
      if(!res){
        continue
      }
      [removeRes,info,pool] = res
      removeResults.push(removeRes)
    }

    let addResults : Array<LiquidityAddRes> = []
    for (let req of liquidityAddReqs){
      let addRes : LiquidityAddRes
      let res =  this.calcAddReq(req,info,pool)
      if(!res){
        continue
      }
      [addRes,info,pool] = res
      addResults.push(addRes)
    }

    return [removeResults,addResults,info,pool,matcherChange]
  }

  /*
     total lpt            total sudtChangeAmount          total ckb
  ---------------  =  ----------------- =  ----------------
   withdrawn lpt        withdrawn sudtChangeAmount?      withdrawn ckb?

   LiquidityRemoveReq -> Sudt
  */
  calcRemoveReq= (removeReq : LiquidityRemoveReq, info:Info, pool:Pool) : [LiquidityRemoveRes,Info,Pool] | null =>{
    let withdrawnSudt = removeReq.lptAmount * info.sudtReserve  / info.totalLiquidity
    let withdrawnCkb = removeReq.lptAmount * info.ckbReserve  / info.totalLiquidity

    if(withdrawnSudt < removeReq.sudtMin || withdrawnCkb < removeReq.ckbMin){
      return null
    }

    if(removeReq.capacityAmount + withdrawnCkb < Sudt.SUDT_FIXED_CAPACITY){
      // this shouldn't happen
      return null
    }
    removeReq.ckbOut =withdrawnCkb
    removeReq.sudtOut = withdrawnSudt


    // update info
    info.ckbReserve -= withdrawnCkb
    info.sudtReserve -= withdrawnSudt

    // update pool
    pool.sudtAmount -= withdrawnSudt
    pool.capacity -= withdrawnCkb

    // compose LiquidityRemoveRes
    let ret = new LiquidityRemoveRes(removeReq)
    // transfer the capacity into new sudtChangeAmount cell
    ret.capacityAmount = removeReq.capacityAmount + withdrawnCkb
    ret.sudtAmount = withdrawnSudt

    return [ret,info,pool]
  }

  /*
    total ckb         add ckb
   -------------  =  ----------
    total sudtChangeAmount        add sudtChangeAmount

      total lpt       total ckb
    ------------  =  -----------
     return lpt?       add ckb
    LiquidityAddReq -> Lpt(size is fixed if script is determined) + change(size is fixed if script is determined)
   */
  calcAddReq = (addReq:LiquidityAddReq, info:Info, pool:Pool ) :[LiquidityAddRes,Info,Pool] | null =>{
    let addRes :LiquidityAddRes = new LiquidityAddRes(addReq)
    // we must reserve capacity of Lpt(sudtChangeAmount) + Sudt(maybe)

    // we do first try that if give all sudtChangeAmount and the needed ckb is enough which includes
    // extra ckb to hold the Lpt cell and a Ckb cell
    /*
      ckb.remain            ------------------------------------->  ckb-change
      ckb.for_lpt_capacity  ->    |--Lpt.SUDT_CAPACITY--|
      ckb.exchange                |     LPT tokens      |
      sudtChangeAmount.exchange               |---------------------|
     */
    let optimalCkb = info.ckbReserve*addReq.sudtAmount/info.sudtReserve

    if(optimalCkb <= addReq.capacityAmount){
      // the raw ckb is enough for all sudts

      if(optimalCkb < addReq.ckbMin){
        // client refuse by implicit slippage
        return null
      }

      if((optimalCkb + Lpt.LPT_FIXED_CAPACITY + Ckb.CKB_FIXED_CAPACITY) > addReq.capacityAmount){
        // the extra ckb to hold Lpt and Ckb -change cell is not enough
        // we simply reject this case
        // this can do more optimize like do not exhaust both sudtChangeAmount and ckb,
        // however this is counter-intuitive indeed
        return null
      }

      let lptGot1 = info.totalLiquidity*optimalCkb/info.ckbReserve
      let lptGot2 = info.totalLiquidity*addReq.sudtAmount/info.sudtReserve
      let lptGot = lptGot1 > lptGot2?lptGot1:lptGot2

      addRes.lptAmount = lptGot
      addRes.ckbChangeAmount = addReq.capacityAmount - optimalCkb
        - Lpt.LPT_FIXED_CAPACITY - Ckb.CKB_FIXED_CAPACITY
      addRes.sudtChangeAmount = 0n
      addRes.changeType = 'ckb'

      info.totalLiquidity += lptGot
      info.ckbReserve += optimalCkb
      info.sudtReserve += addReq.sudtAmount

      pool.capacity += optimalCkb
      pool.sudtAmount +=addReq.sudtAmount
    }
    else{
      // since all capacity is used to exchange without any left to hold cells
      // and the sudtChangeAmount is still to much, thus we must construct Sudt cell to hold remaining sudtChangeAmount

      // use all available ckb to get sudtChangeAmount
      let ckbToHoldCell = Lpt.LPT_FIXED_CAPACITY + Sudt.SUDT_FIXED_CAPACITY

      let spentCkb = addReq.capacityAmount - ckbToHoldCell

      let optimalSudt = spentCkb*info.sudtReserve/info.ckbReserve

      if(optimalSudt < addReq.sudtMin){
        // client refuse by implicit slippage
        return null
      }

      if(optimalSudt > addReq.sudtAmount){
        // this should not happen!!!
        return null
      }


      let lptGot1 = info.totalLiquidity*spentCkb/info.ckbReserve
      let lptGot2 = info.totalLiquidity*optimalSudt/info.sudtReserve
      let lptGot = lptGot1 > lptGot2?lptGot1:lptGot2

      addRes.lptAmount = lptGot
      addRes.ckbChangeAmount = 0n
      addRes.sudtChangeAmount = addReq.sudtAmount -optimalSudt
      addRes.changeType = 'sudt'

      info.totalLiquidity += lptGot
      info.sudtReserve += optimalSudt
      info.ckbReserve += spentCkb

      pool.capacity += spentCkb
      pool.sudtAmount += optimalSudt
    }
    return [addRes,info,pool]
  }
}
