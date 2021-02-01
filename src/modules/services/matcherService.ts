import { injectable } from 'inversify'
import { Sudt } from '../models/cells/sudt'
import { Ckb } from '../models/cells/ckb'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { Lpt } from '../models/cells/lpt'
import { LiquidityMatch } from '../models/matches/liquidityMatch'
import { SwapMatch } from '../models/matches/swapMatch'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { LiquidityInitTransformation } from '../models/transformation/liquidityInitTransformation'
// @ts-ignore
import sqrt from 'bigint-isqrt'
import { logger } from '../../utils/logger'

@injectable()
export default class MatcherService {

  // @ts-ignore
  #info = (msg: string) => {
    logger.info(`MatcherService: ${msg}`)
  }
  // @ts-ignore
  #error = (msg: string) => {
    logger.error(`MatcherService: ${msg}`)
  }

  constructor() {}

  // the context inside of SwapMatch is updated during processing match
  matchSwap = (swapMatch: SwapMatch): void => {
    for (let buyXform of swapMatch.buyXforms) {
      this.processSwapBuyTransformation(swapMatch, buyXform)
    }

    for (let sellXform of swapMatch.sellXforms) {
      this.processSwapSellTransformation(swapMatch, sellXform)
    }

    if (swapMatch.buyXforms.every(xform => xform.skip) && swapMatch.sellXforms.every(xform => xform.skip)) {
      swapMatch.skip = true
    } else {
      swapMatch.matcherChange.reduceBlockMinerFee()
    }
  }

  /*
  info -> info
  pool -> pool
  matcherChange_ckb -> matcherChange_ckb
  swap_buy -> sudt

  buy = buy sudt
  ckb -> sudt
 */
  processSwapBuyTransformation = (swapMatch: SwapMatch, swapBuyXform: SwapBuyTransformation): void => {
    // spend ckb to get sudt
    // ckb -> sudt

    // since you can not spend all ckb because we need some to hold the output sudt cell
    if (swapBuyXform.request.capacity - swapBuyXform.request.tips <= SwapBuyTransformation.SUDT_FIXED_CAPACITY) {
      swapBuyXform.skip = true
      return
    }

    // the formula is as same as before :0
    // (ckb_reserve  + spent_ckb * 99.7% ) (sudt_reserve - sudt_got) <= sudt_reserve * ckb_reserve
    // ckb_reserve * - sudt_got + spent_ckb * 99.7% * sudt_reserve + spent_ckb * 99.7% * - sudt_got <=0
    // spent_ckb * 99.7% * sudt_reserve <= ckb_reserve * sudt_got + spent_ckb * 99.7% * sudt_got
    // spent_ckb * 99.7% * sudt_reserve <= (ckb_reserve + spent_ckb * 99.7% )* sudt_got
    // spent_ckb * 997 * sudt_reserve <= (ckb_reserve * 1000 + spent_ckb * 997 )* sudt_got
    // sudt_got >= spent_ckb * 997 * sudt_reserve / (ckb_reserve * 1000 + spent_ckb * 997 )

    let ckbIn = swapBuyXform.request.capacity - swapBuyXform.request.tips - SwapBuyTransformation.SUDT_FIXED_CAPACITY

    let sudtGot = (ckbIn * 997n * swapMatch.info.sudtReserve) / (swapMatch.info.ckbReserve * 1000n + ckbIn * 997n) + 1n

    if (sudtGot < swapBuyXform.request.amountOutMin) {
      swapBuyXform.skip = true
      return
    }

    // flush the result into Xform
    swapBuyXform.sudtAmount = sudtGot

    // update context of swapMatch
    // matcher get tips
    swapMatch.matcherChange.capacity += swapBuyXform.request.tips

    // then all ckb, include of 0.3% as liquidity provider interest, goes into pool
    swapMatch.info.ckbReserve += ckbIn
    swapMatch.info.sudtReserve -= sudtGot

    swapMatch.pool.capacity += ckbIn
    swapMatch.pool.sudtAmount -= sudtGot
  }

  /*
  info -> info
  pool -> pool
  matcherChange_ckb -> matcherChange_ckb
  swap_sell -> ckb

  sell = sell sudt
  sudt -> ckb
  */
  processSwapSellTransformation = (swapMatch: SwapMatch, swapSellXform: SwapSellTransformation): void => {
    // spend sudt to get ckb
    // sudt -> ckb

    // (sudt_reserve + spent_sudt * 99.7%)(ckb_reserve - ckb_got) <= sudt_reserve * ckb_reserve
    // sudt_reserve * - ckb_got + spent_sudt * 99.7% * ckb_reserve + spent_sudt * 99.7% * - ckb_got <=0
    // spent_sudt * 99.7% * ckb_reserve <= sudt_reserve * ckb_got + spent_sudt * 99.7% * ckb_got
    // spent_sudt * 99.7% * ckb_reserve <= (sudt_reserve + spent_sudt * 99.7% )* ckb_got
    // spent_sudt * 997 * ckb_reserve <= (sudt_reserve * 1000 + spent_sudt * 997 )* ckb_got
    // ckb_got >= spent_sudt * 997 * ckb_reserve / (sudt_reserve * 1000 + spent_sudt * 997 )

    let ckbOut: bigint =
      (swapSellXform.request.sudtAmount * 997n * swapMatch.info.ckbReserve) /
        (swapMatch.info.sudtReserve * 1000n + swapSellXform.request.sudtAmount * 997n) +
      1n

    if (ckbOut < swapSellXform.request.amountOutMin) {
      swapSellXform.skip = true
      return
    }

    if (
      ckbOut + swapSellXform.request.capacity <
      SwapSellTransformation.CKB_FIXED_MIN_CAPACITY + swapSellXform.request.tips
    ) {
      swapSellXform.skip = true
      return
    }

    swapSellXform.capacity =
      ckbOut +
      swapSellXform.request.capacity -
      //SwapSellTransformation.CKB_FIXED_MIN_CAPACITY -
      swapSellXform.request.tips

    swapMatch.matcherChange.capacity += swapSellXform.request.tips

    // then all remaining sudtChangeAmount, include of 0.3% as liquidity provider interest, goes into pool
    swapMatch.info.sudtReserve += swapSellXform.request.sudtAmount
    swapMatch.info.ckbReserve -= ckbOut

    swapMatch.pool.sudtAmount += swapSellXform.request.sudtAmount
    swapMatch.pool.capacity -= ckbOut
  }

  /*
  Info -> Info
  Pool -> Pool
  [removeReq] -> [removeRes(Sudt-cell)]
  [addReq] -> [addRes(Lpt-cell + Sudt-change-cell)]
   */

  matchLiquidity = (liquidityMatch: LiquidityMatch): void => {
    for (let addXform of liquidityMatch.addXforms) {
      this.processLiquidityAddTransformation(liquidityMatch, addXform)
    }

    for (let removelXform of liquidityMatch.removeXforms) {
      this.processLiquidityRemoveTransformation(liquidityMatch, removelXform)
    }

    if (liquidityMatch.removeXforms.every(xform => xform.skip) && liquidityMatch.addXforms.every(xform => xform.skip)) {
      liquidityMatch.skip = true
    } else {
      liquidityMatch.matcherChange.reduceBlockMinerFee()
    }
  }

  /*
    total lpt            total sudtChangeAmount          total ckb
 ---------------  =  ----------------- =  ----------------
  withdrawn lpt        withdrawn sudtChangeAmount?      withdrawn ckb?

  LiquidityRemoveReq -> Sudt + Ckb
 */
  processLiquidityRemoveTransformation = (
    liquidityMatch: LiquidityMatch,
    liquidityRemoveXform: LiquidityRemoveTransformation,
  ): void => {
    let withdrawnSudt =
      (liquidityRemoveXform.request.lptAmount * liquidityMatch.info.sudtReserve) / liquidityMatch.info.totalLiquidity +
      1n
    let withdrawnCkb =
      (liquidityRemoveXform.request.lptAmount * liquidityMatch.info.ckbReserve) / liquidityMatch.info.totalLiquidity +
      1n

    if (withdrawnSudt < liquidityRemoveXform.request.sudtMin || withdrawnCkb < liquidityRemoveXform.request.ckbMin) {
      liquidityRemoveXform.skip = true
      return
    }

    if (
      liquidityRemoveXform.request.capacityAmount + withdrawnCkb <
      LiquidityRemoveTransformation.REMOVE_XFORM_FIXED_MIN_CAPACITY + liquidityRemoveXform.request.tips
    ) {
      liquidityRemoveXform.skip = true
      return
    }

    liquidityMatch.matcherChange.capacity += liquidityRemoveXform.request.tips

    liquidityRemoveXform.sudtAmount = withdrawnSudt
    liquidityRemoveXform.capacityAmount =
      liquidityRemoveXform.request.capacityAmount + withdrawnCkb - liquidityRemoveXform.request.tips

    // update info
    liquidityMatch.info.ckbReserve -= withdrawnCkb
    liquidityMatch.info.sudtReserve -= withdrawnSudt

    liquidityMatch.info.totalLiquidity -= liquidityRemoveXform.request.lptAmount

    // update pool
    liquidityMatch.pool.sudtAmount -= withdrawnSudt
    liquidityMatch.pool.capacity -= withdrawnCkb
  }

  /*
   total ckb         add ckb
  -------------  =  ----------
   total sudt        add sudt

     total lpt       total ckb
   ------------  =  -----------
    return lpt?       add ckb
   LiquidityAddReq -> Lpt(size is fixed if script is determined) + change(size is fixed if script is determined)
  */
  processLiquidityAddTransformation = (
    liquidityMatch: LiquidityMatch,
    liquidityAddXform: LiquidityAddTransformation,
  ): void => {
    // first we try to use all available and have to has sudt cell to keep the change
    let ckbAvailable =
      liquidityAddXform.request.capacityAmount -
      liquidityAddXform.request.tips -
      Lpt.LPT_FIXED_CAPACITY -
      Sudt.SUDT_FIXED_CAPACITY

    if (ckbAvailable <= 0n) {
      liquidityAddXform.skip = true
      return
    }

    let sudtNeeded = (ckbAvailable * liquidityMatch.info.sudtReserve) / liquidityMatch.info.ckbReserve + 1n

    if (sudtNeeded < liquidityAddXform.request.sudtAmount) {
      // OK, we use all ckb we can use and sudt remains
      let lptGot = (liquidityMatch.info.totalLiquidity * ckbAvailable) / liquidityMatch.info.ckbReserve + 1n

      liquidityMatch.matcherChange.capacity += liquidityAddXform.request.tips

      // of cause, because we drain all available ckbs and only leave these for hold cells
      liquidityAddXform.capacityChangeAmount = Lpt.LPT_FIXED_CAPACITY + Sudt.SUDT_FIXED_CAPACITY
      liquidityAddXform.sudtChangeAmount = liquidityAddXform.request.sudtAmount - sudtNeeded
      liquidityAddXform.lptAmount = lptGot

      // update info
      liquidityMatch.info.ckbReserve += ckbAvailable
      liquidityMatch.info.sudtReserve += sudtNeeded

      liquidityMatch.info.totalLiquidity += lptGot

      liquidityMatch.pool.capacity += ckbAvailable
      liquidityMatch.pool.sudtAmount += sudtNeeded
    } else {
      // sudt is not enough, we drain all sudts

      let ckbNeeded =
        (liquidityAddXform.request.sudtAmount * liquidityMatch.info.ckbReserve) / liquidityMatch.info.sudtReserve + 1n

      const ckbLeft = liquidityAddXform.request.capacityAmount - liquidityAddXform.request.tips - ckbNeeded
      if (ckbLeft < Ckb.CKB_FIXED_MIN_CAPACITY + Lpt.LPT_FIXED_CAPACITY) {
        // this shouldn't happens
        return
      }

      let lptGot = (liquidityMatch.info.totalLiquidity * sudtNeeded) / liquidityMatch.info.sudtReserve + 1n

      liquidityMatch.matcherChange.capacity += liquidityAddXform.request.tips

      // of cause, because we drain all available ckbs and only leave these for hold cells
      liquidityAddXform.capacityChangeAmount = ckbLeft
      liquidityAddXform.sudtChangeAmount = 0n
      liquidityAddXform.lptAmount = lptGot

      // update info
      liquidityMatch.info.ckbReserve += ckbNeeded
      liquidityMatch.info.sudtReserve += liquidityAddXform.request.sudtAmount

      liquidityMatch.info.totalLiquidity += lptGot

      liquidityMatch.pool.capacity += ckbNeeded
      liquidityMatch.pool.sudtAmount += liquidityAddXform.request.sudtAmount
    }
  }

  // req -> lpt
  initLiquidity = (liquidityMatch: LiquidityMatch): void => {
    let liquidityInitXform = liquidityMatch.initXforms!

    let ckbAvailable =
      liquidityInitXform.request.capacityAmount -
      liquidityInitXform.request.tips -
      LiquidityInitTransformation.LPT_FIXED_CAPACITY

    let lptMinted = sqrt(ckbAvailable * liquidityInitXform.request.sudtAmount)

    liquidityInitXform.lptAmount = lptMinted

    liquidityMatch.matcherChange.capacity += liquidityInitXform.request.tips

    // update info
    liquidityMatch.info.ckbReserve += ckbAvailable
    liquidityMatch.info.sudtReserve += liquidityInitXform.request.sudtAmount

    liquidityMatch.info.totalLiquidity += lptMinted

    liquidityMatch.pool.capacity += ckbAvailable
    liquidityMatch.pool.sudtAmount += liquidityInitXform.request.sudtAmount
  }
}
