import { CellCollector, Indexer } from '@ckb-lumos/indexer'
import {
  DEFAULT_NODE_URL,
  INDEXER_DB_PATH,
  INFO_QUERY_OPTION,
  LIQUIDITY_ADD_REQ_QUERY_OPTION,
  LIQUIDITY_REMOVE_REQ_QUERY_OPTION, MATCHER_QUERY_OPTION,
  POOL_QUERY_OPTION,
  SWAP_BUY_REQ_QUERY_OPTION,
  SWAP_SELL_REQ_QUERY_OPTION,
} from '../../utils'
import { SwapBuyReq } from '../models/cells/swapBuyReq'
import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { LiquidityRemoveReq } from '../models/cells/liquidityRemoveReq'
import { LiquidityAddReq } from '../models/cells/liquidityAddReq'
import { MatcherChange } from '../models/cells/matcherChange'
import RpcService from './rpcService'
import { modules } from '../../container'
import { Cell } from '@ckb-lumos/base'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { SwapSellReq } from '../models/cells/swapSellReq'

@injectable()
export default class ScanService {
  readonly #indexer!: Indexer
  readonly #rpcService: RpcService


  constructor(
    @inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService,
  ) {
    this.#indexer = new Indexer(DEFAULT_NODE_URL, INDEXER_DB_PATH)
    this.#indexer.startForever()
    this.#rpcService = rpcService
  }

  startIndexer = () => {
    if (!this.#indexer.running()) {
      this.#indexer.startForever()
    }
  }

  subscribeReqs = () => {
    this.startIndexer()

    const subscription_swap_buy_reqs = this.#indexer.subscribe(SWAP_BUY_REQ_QUERY_OPTION)

    subscription_swap_buy_reqs.on('changed', () => {
      //do nothing here cause we will poll it in cron jobs
    })

    const subscription_swap_sell_reqs = this.#indexer.subscribe(SWAP_SELL_REQ_QUERY_OPTION)

    subscription_swap_sell_reqs.on('changed', () => {
      //do nothing here cause we will poll it in cron jobs
    })

    const subscription_liquidity_add_reqs = this.#indexer.subscribe(LIQUIDITY_ADD_REQ_QUERY_OPTION)

    subscription_liquidity_add_reqs.on('changed', () => {
      //do nothing here cause we will poll it in cron jobs
    })

    const subscription_liquidity_remove_reqs = this.#indexer.subscribe(LIQUIDITY_REMOVE_REQ_QUERY_OPTION)

    subscription_liquidity_remove_reqs.on('changed', () => {
      //do nothing here cause we will poll it in cron jobs
    })
  }

  getTip = async (): Promise<bigint> => {
    return BigInt((await this.#indexer.tip()).block_number)
  }

  scanAll = async (): Promise<[
    Array<LiquidityAddTransformation>,
    Array<LiquidityRemoveTransformation>,
    Array<SwapBuyTransformation>,
    Array<SwapSellTransformation>,
    Info,
    Pool,
    MatcherChange]> => {
    const tip = (await this.getTip()).toString(16)

    let [liquidityAddReqs, liquidityRemoveReqs, swapBuyReqs, swapSellReqs] = await this.scanReqs(tip)
    let matcherChange = await this.scanMatcherChange(tip)
    let [info, pool] = await this.scanInfoCell(tip)

    let liquidityAddTransformations = liquidityAddReqs.map(req => new LiquidityAddTransformation(req))
    let liquidityRemoveTransformations = liquidityRemoveReqs.map(req => new LiquidityRemoveTransformation(req))
    let swapBuyTransformations = swapBuyReqs.map(req => new SwapBuyTransformation(req))
    let swapSellTransformations = swapSellReqs.map(req => new SwapSellTransformation(req))


    return [liquidityAddTransformations, liquidityRemoveTransformations, swapBuyTransformations, swapSellTransformations,
      info, pool, matcherChange]
  }

  // be careful that the tip is hexicalDecimal
  scanReqs = async (tip?: string): Promise<[
    Array<LiquidityAddReq>,
    Array<LiquidityRemoveReq>,
    Array<SwapBuyReq>,
    Array<SwapSellReq>
  ]> => {
    this.startIndexer()

    const swapBuyReqCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...SWAP_BUY_REQ_QUERY_OPTION,
    })
    const swapBuyReqs: SwapBuyReq[] = []
    for await (const cell of swapBuyReqCollector.collect()) {
      // change to construct
      if (isCellValid(cell)) {

        const script = await this.#rpcService.getLockScript(cell.out_point!, SwapBuyReq.getUserLockHash(cell))
        if (!script) {
          continue
        }
        swapBuyReqs.push(new SwapBuyReq(cell, script!))
      }
    }
    //==============

    const swapSellReqCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...SWAP_SELL_REQ_QUERY_OPTION,
    })
    const swapSellReqs: SwapSellReq[] = []
    for await (const cell of swapSellReqCollector.collect()) {
      // change to construct
      if (isCellValid(cell)) {

        const script = await this.#rpcService.getLockScript(cell.out_point!, SwapSellReq.getUserLockHash(cell))
        if (!script) {
          continue
        }
        swapSellReqs.push(new SwapSellReq(cell, script!))
      }
    }

    //==============
    const liquidityAddReqCollector = new CellCollector(this.#indexer,
      {
        toBlock: tip,
        ...LIQUIDITY_ADD_REQ_QUERY_OPTION,
      },
    )
    const liquidityAddReqs: Array<LiquidityAddReq> = []
    for await (const cell of liquidityAddReqCollector.collect()) {
      if (isCellValid(cell)) {
        const script = await this.#rpcService.getLockScript(cell.out_point!, LiquidityAddReq.getUserLockHash(cell))
        if (!script) {
          continue
        }
        liquidityAddReqs.push(new LiquidityAddReq(cell, script))
      }
    }

    //==============
    const liquidityRemoveReqs: Array<LiquidityRemoveReq> = []
    const liquidityRemoveReqCollector = new CellCollector(this.#indexer,
      {
        toBlock: tip,
        ...LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
      },
    )
    for await (const cell of liquidityRemoveReqCollector.collect()) {
      if (isCellValid(cell)) {
        const script = await this.#rpcService.getLockScript(cell.out_point!, LiquidityRemoveReq.getUserLockHash(cell))
        if (!script) {
          continue
        }
        liquidityRemoveReqs.push(new LiquidityRemoveReq(cell, script))
      }
    }

    return [liquidityAddReqs, liquidityRemoveReqs, swapBuyReqs, swapSellReqs]
  }

  scanMatcherChange = async (tip?: string): Promise<MatcherChange> => {
    const MatcherCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...MATCHER_QUERY_OPTION,
    })
    let matcherChange: MatcherChange | null = null
    for await (const cell of MatcherCollector.collect()) {
      if (isCellValid(cell)) {
        matcherChange =  MatcherChange.fromCell(cell)
      }
    }
    if (!matcherChange ) {
      throw new Error('matcher change not found')
    }

    return matcherChange
  }

  scanInfoCell = async (tip?: string): Promise<[Info, Pool]> => {
    const infoCellCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...INFO_QUERY_OPTION,
    })
    let info: Info | null = null
    for await (const cell of infoCellCollector.collect()) {
      if (isCellValid(cell)) {
        info = Info.fromCell(cell)
      }
    }

    const poolCellCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...POOL_QUERY_OPTION,
    })
    let pool: Pool | null = null
    for await (const cell of poolCellCollector.collect()) {
      if (isCellValid(cell)) {
        pool =  Pool.fromCell(cell)
      }
    }

    if (!info || !pool) {
      throw new Error('info or pool not found')
    }

    return [info!, pool!]
  }
}

function isCellValid(_cell: Cell) {
  return true
}
