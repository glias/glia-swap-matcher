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
import { MatchRecord } from '../models/matches/matchRecord'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { LiquidityInitTransformation } from '../models/transformation/liquidityInitTransformation'
import JSONbig from 'json-bigint'

const jsonbig = JSONbig({ useNativeBigInt: true,alwaysParseAsBig:true})


@injectable()
export default class TaskService {
  readonly #scanService: ScanService
  readonly #dealService: DealService
  readonly #rpcService: RpcService
  readonly #matcherService: MatcherService
  readonly #transactionService: TransactionService

  readonly #schedule = '*/2 * * * * *'

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

    [addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange] = scanRes

    // use the info's outpoint to search our db
    // the result may be null, may present with Committed, or may present with Sent
    const dealRes: Deal | null = await this.#dealService.getByTxHash(info.outPoint.tx_hash)

    if (!dealRes) {
      // are lose the leading advantage
      await this.compete(addXforms,removeXforms,sellXforms,buyXforms,info,pool,matcherChange)

    } else {
      // yes, we are dominating the info-chain
      await this.dominate(dealRes,addXforms,removeXforms,sellXforms,buyXforms,info,pool,matcherChange)
    }
  }

  compete = async (addXforms: Array<LiquidityAddTransformation>,
                   removeXforms:Array<LiquidityRemoveTransformation>,
                   sellXforms:Array<SwapSellTransformation>,
                   buyXforms:Array<SwapBuyTransformation>,
                   // current info, which is competed
                   info:Info,
                   pool:Pool,
                   matcherChange:MatcherChange) =>{
    // we lose the control of info cell chain

    // 1 first we check if we have derived the info, maybe we make deals based on the info in before match job
    // if yes, keep all the derivatives to sent naturally and update all others to committed or cut-off
    const directDerivative :Array<Deal>= await this.#dealService.getAllDerivates(info.outPoint.tx_hash)
    const directDerivativeTxHash :Array<String>= directDerivative.map(deal => deal.txHash)

    let sentDeals: Array<Deal> = await this.#dealService.getAllSentDeals()

    // old deals are txs dont derive the current Info
    let oldDeals = sentDeals.filter(deal =>{
      return !directDerivativeTxHash.includes(deal.txHash)
    })

    if (oldDeals.length) {
      let oldDealsTxHashes = oldDeals.map(deal => deal.txHash)
      let oldDealsStatus = await this.#rpcService.getTxsStatus(oldDealsTxHashes)
      await this.#dealService.updateDealsStatus(oldDealsStatus)
    }

    // 2 if there are derivatives, continue on it
    // if not, base on the current info cell
    await this.continue(addXforms,removeXforms,sellXforms,buyXforms,info,pool,matcherChange)
  }


  dominate = async(deal:Deal,
                   addXforms: Array<LiquidityAddTransformation>,
                   removeXforms:Array<LiquidityRemoveTransformation>,
                   sellXforms:Array<SwapSellTransformation>,
                   buyXforms:Array<SwapBuyTransformation>,
                   info:Info,
                   pool:Pool,
                   matcherChange:MatcherChange) =>{
    // the info is in our deal tx, we dominate the matching

    // 1st, the deals includes the info.txHash and all previous is definitely committed
    // update all the tx and its pre-txs to committed
    await this.#dealService.updateDealTxsChainsToCommited(deal)

    // 2nd, get the latest sent deal by sort 'id'

    await this.continue(addXforms,removeXforms,sellXforms,buyXforms,info,pool,matcherChange)
  }


  continue = async (addXforms: Array<LiquidityAddTransformation>,
                    removeXforms:Array<LiquidityRemoveTransformation>,
                    sellXforms:Array<SwapSellTransformation>,
                    buyXforms:Array<SwapBuyTransformation>,
                    info:Info,
                    pool:Pool,
                    matcherChange:MatcherChange) =>{
    // now we check Sent deals one by one to see if any input req are used by users
    let sentDeals: Array<Deal> = await this.#dealService.getAllSentDeals()
    let baseDeal :[Info,Pool,MatcherChange] | Deal= [info,pool,matcherChange]
    // map into the outpoint
    let xformReqOutpoints = [addXforms, removeXforms, buyXforms, sellXforms].flatMap(xforms => {
      // @ts-ignore
      return xforms.map(xform => xform.request.getOutPoint())
    })

    // mark if some reqs are dropped by user
    let drop = false
    for (let sentDeal of sentDeals) {

      // if some reqs are dropped, all following deals are useless
      if (drop) {
        this.#dealService.updateDealStatus(sentDeal.txHash, DealStatus.CutOff)
        continue
      }

      let fine = true
      let sentReqOutpoints: Array<string> = sentDeal.reqOutpoints.split(',')

      for (let sentReqOutpoint of sentReqOutpoints) {
        if (!xformReqOutpoints.includes(sentReqOutpoint)) {
          // the req is used buy client
          this.#info(`a request of ${sentReqOutpoint} is missing/cancelled`)
          fine = false
          break
        }
      }

      if (fine) {
        // re-send the deal tx and remove those reqs in the request list
        await this.#rpcService.sendTransaction(jsonbig.parse(sentDeal.tx))

        // eliminate xforms in the deal
        addXforms = addXforms.filter(
          addXform => !sentReqOutpoints.includes(addXform.request.getOutPoint())
        )
        removeXforms = removeXforms.filter(
          removeXform => !sentReqOutpoints.includes(removeXform.request.getOutPoint()),
        )
        buyXforms = buyXforms.filter(
          buyXform => !sentReqOutpoints.includes(buyXform.request.getOutPoint())
        )
        sellXforms = sellXforms.filter(
          sellXform => !sentReqOutpoints.includes(sellXform.request.getOutPoint())
        )

        // new match should base on this deal
        baseDeal = sentDeal
      } else {
        // at least one of the req this deal handles is missing
        // cut off this deal tx and those following it, do a new match
        // and do cut off following deals too in next loops
        await this.#dealService.updateDealStatus(sentDeal.txHash, DealStatus.CutOff)
        drop = true
      }
    }
    // now do the matching job based on the based deal
    // if some deals is cut off, there likely to be a new match (reqs in the deals still remains), maybe not
    if(Array.isArray(baseDeal) ){
      const base:[Info,Pool,MatcherChange] = baseDeal
      await this.handler(addXforms, removeXforms, buyXforms, sellXforms, base[0], base[1], base[2])
    }else {
      const info = Info.fromJSON(jsonbig.parse(baseDeal.info))
      const pool = Pool.fromJSON(jsonbig.parse(baseDeal.pool))
      const matcherChange = MatcherChange.fromJSON(jsonbig.parse(baseDeal.matcherChange))
      await this.handler(addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange)
    }

  }

  // given an info and request to make a match job
  handler = async (
    addXforms: Array<LiquidityAddTransformation>,
    removeXforms: Array<LiquidityRemoveTransformation>,
    swapBuyforms: Array<SwapBuyTransformation>,
    swapSellXforms: Array<SwapSellTransformation>,
    info: Info,
    pool: Pool,
    matcherChange: MatcherChange,
  ) => {
    let matchRecord: MatchRecord
    // if the pool of pair is empty
    if (info.sudtReserve === 0n || info.ckbReserve === 0n) {
      if (addXforms.length == 0) {
        // have to init but no one add liquidity, have to quit

        this.#info('no add request for init liquidity')
        return
      }

      matchRecord = new MatchRecord(info, pool, matcherChange, [], [], addXforms, [])
      matchRecord.initXforms = new LiquidityInitTransformation(addXforms[0].request)
      matchRecord.addXforms = []

      this.#matcherService.initLiquidity(matchRecord)

      this.#transactionService.composeLiquidityInitTransaction(matchRecord)


      return
    }else{
      matchRecord = new MatchRecord(
        info,
        pool,
        matcherChange,
        swapSellXforms,
        swapBuyforms,
        addXforms,
        removeXforms,
      )
      this.#matcherService.match(matchRecord)

      this.#transactionService.composeTransaction(matchRecord)
    }



    if (!matchRecord.skip) {
      let outpointsProcessed: Array<string> = []
      outpointsProcessed = outpointsProcessed.concat(matchRecord.sellXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(matchRecord.buyXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(matchRecord.addXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(matchRecord.removeXforms.map(xform => xform.request.getOutPoint()))

      await this.#rpcService.sendTransaction(matchRecord.composedTx!)

      // @ts-ignore
      const deal: Omit<Deal, 'createdAt' | 'id'> = {
        txHash: matchRecord.composedTxHash!,
        preTxHash: matchRecord.info.outPoint.tx_hash,
        tx: jsonbig.stringify(matchRecord.composedTx),
        info: jsonbig.stringify(matchRecord.info),
        pool: jsonbig.stringify(matchRecord.pool),
        matcherChange: jsonbig.stringify(matchRecord.matcherChange),
        reqOutpoints: outpointsProcessed.join(','),
        status: DealStatus.Sent,
      }
      await this.#dealService.saveDeal(deal)
    }
  }
}
