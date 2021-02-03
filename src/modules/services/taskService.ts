import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { CronJob } from 'cron'
import { modules } from '../../container'
import { logger } from '../../utils/logger'
import { Deal, DealStatus } from '../models/entities/deal.entity'
import ScanService from './scanService'
import RpcService from './rpcService'
import DealService from './dealService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { MatcherChange } from '../models/cells/matcherChange'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { LiquidityMatch } from '../models/matches/liquidityMatch'
import { SwapMatch } from '../models/matches/swapMatch'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { LiquidityInitTransformation } from '../models/transformation/liquidityInitTransformation'
import JSONbig from 'json-bigint'

@injectable()
export default class TaskService {
  readonly #scanService: ScanService
  readonly #dealService: DealService
  readonly #rpcService: RpcService
  readonly #matcherService: MatcherService
  readonly #transactionService: TransactionService

  readonly #schedule = '*/5 * * * * *'

  #cronLock: boolean = false

  #info = (msg: string) => {
    logger.info(`TaskService: ${msg}`)
  }
  #error = (msg: string) => {
    logger.error(`TaskService: ${msg}`)
  }

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[ScanService.name])) scanService: ScanService,
    @inject(new LazyServiceIdentifer(() => modules[DealService.name])) dealService: DealService,
    @inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService,
    @inject(new LazyServiceIdentifer(() => modules[MatcherService.name])) matcherService: MatcherService,
    @inject(new LazyServiceIdentifer(() => modules[TransactionService.name])) transactionService: TransactionService,
  ) {
    this.#scanService = scanService
    this.#dealService = dealService
    this.#rpcService = rpcService
    this.#matcherService = matcherService
    this.#transactionService = transactionService
  }

  start = async () => {
    new CronJob(this.#schedule, this.wrapperedTask, null, true)
  }

  readonly wrapperedTask = async () => {
    if (!this.#cronLock) {
      this.#cronLock = true
      try {
        await this.task()
      } catch (e) {
        this.#error('task job error: ' + e)
      } finally {
        this.#cronLock = false
      }
    }
  }

  // registered into cron job
  readonly task = async () => {
    this.#info('task job: ' + new Date())
    // step 1, get latest info cell and scan all reqs

    // step 2
    // 1. if the latest (committed) info cell is not in the 'Sent' deal, which means we are cut off.
    // thus get ALL deal tx -> a. if deal tx is committed, update it as committed,
    //                         b. if deal tx is missing, of cause because we are cut off, update it as CutOff
    //                      -> then base on the latest info cell to do match job
    // note that the cell collector is not atomic, thus the req may be not sync-ed with latest info cell and
    // pool cell. we are based on info cell and pool cells, bear the possibility of missing req cells
    //
    //
    // 2. if the latest info cell is in the 'Sent' deal, which means we dominate,
    // thus we should check all sent txs in the database. for all sent txs in time order
    //   -> if all request in a txs is still available on chain, we resend the tx
    //   -> if at least one of the request is missing, which means client cancelled the request,
    //      we should drop the tx and txs follows it, and then do a new matching job
    // at last, if all txs is fine and re-send and there has more requests left, do a new matching job
    // thus set all previous deal tx to committed, as the state transfer make sure that they must be committed
    // and then based on the last 'Sent' deal tx, do match job.
    // Do re-send the 'Sent' deal txs in case of they are somehow dropped by miner. we could ignore pending state
    // and force re-send again :)

    let scanRes = await this.#scanService.scanAll()
    // console.log('scanRes: '+JSONbig.stringify(scanRes))
    let addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange

    ;[addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange] = scanRes

    // use the info's outpoint to search our db
    // the result may be null, may present with Committed, or may present with Sent
    const dealRes: Deal | null = await this.#dealService.getByTxHash(info.outPoint.tx_hash)

    if (!dealRes) {
      // the info is not in our deal, some one cuts off our deals, or maybe we are new to the pair

      // get all deal txs we sent
      // let sentDeals: Array<Deal> = await this.#dealService.getAllSentDeals()
      //
      // if (sentDeals.length) {
      //   let sent_deals_txHashes = sentDeals.map(deal => deal.txHash)
      //   // get all status of our sent deal txs and update them
      //   // some maybe set to committed
      //   // some maybe set to cut-off, if there are no res of a tx, that means it is cut off
      //   let sentDealsStatus = await this.#rpcService.getTxsStatus(sent_deals_txHashes)
      //   await this.#dealService.updateDealsStatus(sentDealsStatus)
      // }

      // based on the current situation, do a new matching job

      await this.handler(addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange)
    } else {
      // the info is in our deal tx, we dominate the matching

      // 1st, the deals includes the info.txHash and all previous is definitely committed
      // update all the tx and its pre-txs to committed
      await this.#dealService.updateDealTxsChainsToCommited(dealRes)

      // 2nd, get the latest sent deal by sort 'id'
      let sentDeals: Array<Deal> = await this.#dealService.getAllSentDeals()

      // now we check Sent deals one by one to see if any input req are used by users

      // map into the outpoint
      let xformReqOutpoints = [addXforms, removeXforms, buyXforms, sellXforms].flatMap(xforms => {
        // @ts-ignore
        return xforms.map(xform => xform.request.getOutPoint)
      })

      let drop = false
      for (let sentDeal of sentDeals) {
        if (drop) {
          this.#dealService.updateDealStatus(sentDeal.txHash, DealStatus.CutOff)
          continue
        }

        let fine = true
        let sentReqOutpoints: Array<string> = sentDeal.reqOutpoints.split(',')

        for (let sentReqOutpoint of sentReqOutpoints) {
          if (!xformReqOutpoints.includes(sentReqOutpoint)) {
            // the req is used buy client
            fine = false
            break
          }
        }

        if (fine) {
          // re-send the deal tx and remove those reqs in the request list
          await this.#rpcService.sendTransaction(JSONbig.parse(sentDeal.tx))

          addXforms = addXforms.filter(addXform => !sentReqOutpoints.includes(addXform.request.getOutPoint()))
          removeXforms = removeXforms.filter(
            removeXform => !sentReqOutpoints.includes(removeXform.request.getOutPoint()),
          )
          buyXforms = buyXforms.filter(buyXform => !sentReqOutpoints.includes(buyXform.request.getOutPoint()))
          sellXforms = sellXforms.filter(sellXform => !sentReqOutpoints.includes(sellXform.request.getOutPoint()))
        } else {
          // cut off this deal tx and those following it, do a new match
          this.#dealService.updateDealStatus(sentDeal.txHash, DealStatus.CutOff)
          drop = true
        }
      }
      // now do the matching job
      // if some deals is cut off, there likely to be a new match (reqs in the deals still remains), maybe not
      await this.handler(addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange)
    }
  }

  handler = async (
    addXforms: Array<LiquidityAddTransformation>,
    removeXforms: Array<LiquidityRemoveTransformation>,
    swapBuyforms: Array<SwapBuyTransformation>,
    swapSellXforms: Array<SwapSellTransformation>,
    info: Info,
    pool: Pool,
    matcherChange: MatcherChange,
  ) => {
    // if the pool of pair is empty
    if (info.sudtReserve === 0n || info.ckbReserve === 0n) {
      await this.handlerInit(addXforms, info, pool, matcherChange)
      return
    }

    let liquidityMatch: LiquidityMatch = new LiquidityMatch(info, pool, matcherChange, addXforms, removeXforms)
    this.#matcherService.matchLiquidity(liquidityMatch)

    let newInfo, newPool, newMatcherChange
    ;[newInfo, newPool, newMatcherChange] = this.#transactionService.composeLiquidityTransaction(liquidityMatch)

    if (!liquidityMatch.skip) {
      let outpointsProcessed: Array<string> = []
      outpointsProcessed = outpointsProcessed.concat(liquidityMatch.addXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(
        liquidityMatch.removeXforms.map(xform => xform.request.getOutPoint()),
      )

      await this.#rpcService.sendTransaction(liquidityMatch.composedTx!)

      const deal: Omit<Deal, 'createdAt' | 'id'> = {
        txHash: liquidityMatch.composedTxHash!,
        preTxHash: liquidityMatch.info.outPoint.tx_hash,
        tx: JSONbig.stringify(liquidityMatch.composedTx),
        info: JSONbig.stringify(liquidityMatch.info),
        pool: JSONbig.stringify(liquidityMatch.pool),
        matcherChange: JSONbig.stringify(liquidityMatch.matcherChange),
        reqOutpoints: outpointsProcessed.join(','),
        status: DealStatus.Sent,
      }
      await this.#dealService.saveDeal(deal)
    }

    // the info, pool, and matcherChange should base on liquidity tx
    // if the liquidity match is skipped, the info, pool and matcherChange should not be modified
    let swapMatch: SwapMatch = new SwapMatch(newInfo, newPool, newMatcherChange, swapBuyforms, swapSellXforms)

    this.#matcherService.matchSwap(swapMatch)

    this.#transactionService.composeSwapTransaction(swapMatch)

    if (!swapMatch.skip) {
      let outpointsProcessed: Array<string> = []
      outpointsProcessed = outpointsProcessed.concat(swapMatch.buyXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(swapMatch.sellXforms.map(xform => xform.request.getOutPoint()))

      await this.#rpcService.sendTransaction(swapMatch.composedTx!)

      const deal: Omit<Deal, 'createdAt' | 'id'> = {
        txHash: swapMatch.composedTxHash!,
        preTxHash: swapMatch.info.outPoint.tx_hash,
        tx: JSONbig.stringify(swapMatch.composedTx),
        info: JSONbig.stringify(swapMatch.info),
        pool: JSONbig.stringify(swapMatch.pool),
        matcherChange: JSONbig.stringify(swapMatch.matcherChange),
        reqOutpoints: outpointsProcessed.join(','),
        status: DealStatus.Sent,
      }
      await this.#dealService.saveDeal(deal)
    }
  }

  handlerInit = async (
    addXforms: Array<LiquidityAddTransformation>,
    info: Info,
    pool: Pool,
    matcherChange: MatcherChange,
  ) => {
    // have to init
    if (addXforms.length == 0) {
      // have to init but no one add liquidity, have to quit
      return
    }

    let liquidityMatch: LiquidityMatch = new LiquidityMatch(info, pool, matcherChange, [], [])
    liquidityMatch.initXforms = new LiquidityInitTransformation(addXforms[0].request)

    this.#matcherService.initLiquidity(liquidityMatch)
    liquidityMatch.matcherChange.reduceBlockMinerFee()

    this.#transactionService.composeLiquidityInitTransaction(liquidityMatch)
    await this.#rpcService.sendTransaction(liquidityMatch.composedTx!)
  }
}
