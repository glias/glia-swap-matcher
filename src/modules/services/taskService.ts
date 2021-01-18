import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { CronJob } from 'cron'
import { modules } from '../../container'
import { logger } from '../../utils'
import { Deal, DealStatus } from '../models/deal.entity'
import ScanService from './scanService'
import RpcService from './rpcService'
import DealService from './dealService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'
import { LiquidityAddReq } from '../models/liquidityAddReq'
import { LiquidityRemoveReq } from '../models/liquidityRemoveReq'
import { SwapReq } from '../models/swapReq'
import { Info } from '../models/info'
import { Pool } from '../models/pool'
import { MatcherChange } from '../models/matcherChange'

const logTag = `\x1b[35m[Tasks Service]\x1b[0m`

@injectable()
export default class TaskService {
  readonly #scanService: ScanService
  readonly #dealService: DealService
  readonly #rpcService: RpcService
  readonly #matcherService: MatcherService
  readonly #transactionService: TransactionService

  readonly #schedule = '*/5 * * * * *'

  #info = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }
  #warn = (msg: string) => {
    logger.warn(`${logTag}: ${msg}`)
  }

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[ScanService.name])) scanService: ScanService,
    @inject(new LazyServiceIdentifer(() => modules[DealService.name])) dealService: DealService,
    @inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService,
    @inject(new LazyServiceIdentifer(() => modules[MatcherService.name])) matcherService: MatcherService,
    @inject(new LazyServiceIdentifer(() => modules[TransactionService.name])) transactionService: TransactionService,
  ) {
    this.#info('')
    this.#warn('')

    this.#scanService = scanService
    this.#dealService = dealService
    this.#rpcService = rpcService
    this.#matcherService = matcherService
    this.#transactionService = transactionService
  }

  //每个5秒钟扫描所有的pending tx和读取req cells
  //如果订阅的changed事件收到,则提前读取req cells

  start = async () => {
    this.#scanService.subscribeReqs()
    new CronJob(this.#schedule, this.task, null, true)
  }

  // 定时启动
  readonly task = async () => {
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
    // thus set all previous deal tx to committed, as the state transfer make sure that they must be committed
    // and then based on the last 'Sent' deal tx, do match job.
    // Do re-send the 'Sent' deal txs in case of they are somehow dropped by miner. we could ignore pending state
    // and force re-send again :)

    let [addReqs, removeReqs, swapReqs, info, pool, matcherChange] = await this.#scanService.scanAll()

    // use the info's outpoint to search our db
    // the result may be null, may present with Committed, or may present with Sent
    const dealRes: Deal | null = await this.#dealService.getByTxHash(info.txHash)

    if (!dealRes) {
      // the info is not in our deal, some one cuts off our deals

      // get all deal txs we sent
      let sentDeals: Array<Deal> = await this.#dealService.getAllSentDeals()


      if (sentDeals.length) {
        let sent_deals_txHashes = sentDeals.map(deal =>
          deal.txHash,
        )
        // get all status of our sent deal txs and update them
        let sentDealsStatus = await this.#rpcService.getTxsStatus(sent_deals_txHashes)
        this.#dealService.updateDealStatus(sentDealsStatus)
      }

      // based on the current situation, do a new matching job

      await this.handler(addReqs, removeReqs,swapReqs,info,pool,matcherChange)

    } else {
      // the info is in our deal tx, we dominate the matching

      // update all the tx and its pre-txs to committed
      this.#dealService.updateDealTxsChainsToCommited(dealRes)

      // get the latest sent deal by sort 'id'
      let sentDeals: Array<Deal> = await this.#dealService.getAllSentDeals()

      if (!sentDeals.length) {
        // if there are Sent txs, we should base on it to compose new deal
        // now we filter all handled reqs

        let allReqs: Array<string> = sentDeals.flatMap(deal => deal.reqOutpoints.split(','))

        addReqs = addReqs.filter(addReq => {
          !allReqs.includes(addReq.outPoint)
        })
        removeReqs = removeReqs.filter(removeReq => {
          !allReqs.includes(removeReq.outPoint)
        })
        swapReqs = swapReqs.filter(swapReq => {
          !allReqs.includes(swapReq.outPoint)
        })

        info = JSON.parse(sentDeals[0].info)
        pool = JSON.parse(sentDeals[0].pool)
        matcherChange = JSON.parse(sentDeals[0].matcher_change)

        // now do the matching job

        await this.handler(addReqs,removeReqs,swapReqs,info,pool,matcherChange)
      }
    }
  }


  handler = async (addReqs: Array<LiquidityAddReq>,
             removeReqs: Array<LiquidityRemoveReq>,
             swapReqs: Array<SwapReq>,
             info: Info,
             pool: Pool,
             matcherChange: MatcherChange) => {

    let resLiquidity = this.#matcherService.matchLiquidity(removeReqs, addReqs, info, pool, matcherChange)

    // the results of liquidity matching job, to be used to swap matching job
    let rawTx2, txHash2, info2, pool2, matcherChange2
    // compose tx, and then use new updated info, pool and matcher from new cell
    let composeRes2 = this.#transactionService.composeLiquidityTransaction(
      resLiquidity[0],
      resLiquidity[1],
      resLiquidity[2],
      resLiquidity[3],
      resLiquidity[4])
    if (composeRes2 == null) {
      // no tx composed, have to skip
      [rawTx2, txHash2, info2, pool2, matcherChange2] = [null, null, info, pool, matcherChange]
    } else {
      [rawTx2, txHash2, info2, pool2, matcherChange2] = composeRes2!
      // save to db
      let outpointsProcessed: Array<string> = []
      outpointsProcessed = outpointsProcessed.concat(removeReqs.map(req => req.outPoint))
      outpointsProcessed = outpointsProcessed.concat(addReqs.map(req => req.outPoint))

      const deal2: Omit<Deal, 'createdAt' | 'id'> = {
        txHash: txHash2,
        preTxHash: info.rawCell.out_point?.tx_hash!,
        tx: JSON.stringify(rawTx2),
        info: JSON.stringify(info2),
        pool: JSON.stringify(pool2),
        matcher_change: JSON.stringify(matcherChange2),
        reqOutpoints: outpointsProcessed.join(','),
        status: DealStatus.Sent,
      }
      await this.#dealService.saveDeal(deal2)

      // send tx
      await this.#rpcService.sendTransaction(rawTx2)
    }


    let resSwap = this.#matcherService.matchSwap(swapReqs, info2, pool2, matcherChange2)

    let composeRes3 = this.#transactionService.composeSwapTransaction(
      resSwap[0],
      resSwap[1],
      resSwap[2],
      resSwap[3],
    )
    if (composeRes3 == null) {
      // no tx composed, have to skip
      // do nothing
    } else {
      let rawTx3, txHash3, info3, pool3, matcherChange3
      [rawTx3, txHash3, info3, pool3, matcherChange3] = composeRes3!

      // save to db
      // send to
      // save to db
      let outpointsProcessed: Array<string> = []
      outpointsProcessed = outpointsProcessed.concat(swapReqs.map(req => req.outPoint))

      const deal3: Omit<Deal, 'createdAt' | 'id'> = {
        txHash: txHash3,
        preTxHash: info2.rawCell.out_point?.tx_hash!,
        tx: JSON.stringify(rawTx3),
        info: JSON.stringify(info3),
        pool: JSON.stringify(pool3),
        matcher_change: JSON.stringify(matcherChange3),
        reqOutpoints: outpointsProcessed.join(','),
        status: DealStatus.Sent,
      }
      await this.#dealService.saveDeal(deal3)

      // send tx
      await this.#rpcService.sendTransaction(rawTx3)
    }

  }
}
