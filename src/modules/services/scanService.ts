import { CellCollector, Indexer } from '@ckb-lumos/indexer'
import {
  DEFAULT_NODE_URL,
  INDEXER_DB_PATH,
  INFO_QUERY_OPTION,
  LIQUIDITY_ADD_REQ_QUERY_OPTION,
  LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
  MATCHER_SUDT_QUERY_OPTION,
  POOL_QUERY_OPTION,
  SWAP_REQ_QUERY_OPTION,
} from '../../utils'
import { SwapReq } from '../models/swapReq'
import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { Info } from '../models/info'
import { Pool } from '../models/pool'
import { LiquidityRemoveReq } from '../models/liquidityRemoveReq'
import { LiquidityAddReq } from '../models/liquidityAddReq'
import { MatcherChange } from '../models/matcherChange'
import RpcService from './rpcService'
import { modules } from '../../container'
import { Cell } from '@ckb-lumos/base'

@injectable()
export default class ScanService {
  readonly #indexer!: Indexer
  readonly #rpcService: RpcService


  constructor(
    @inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService,
  ) {
    this.#indexer = new Indexer(DEFAULT_NODE_URL, INDEXER_DB_PATH)
    this.#indexer.startForever()
    this.#rpcService =rpcService
  }

  startIndexer = () => {
    if (!this.#indexer.running()) {
      this.#indexer.startForever()
    }
  }

  subscribeReqs = () => {
    this.startIndexer()

    const subscription_swap_reqs = this.#indexer.subscribe(SWAP_REQ_QUERY_OPTION)

    subscription_swap_reqs.on('changed', () => {
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

  scanAll = async () : Promise<[
    Array<LiquidityAddReq>,
    Array<LiquidityRemoveReq>,
    Array<SwapReq>,
    Info,
    Pool,
    MatcherChange]> => {
    const tip = (await this.getTip()).toString(16)

    let [liquidityAddReqs,liquidityRemoveReqs,swapReqs] = await this.scanReqs(tip)
    let matcherChange = await this.scanMatcherChange(tip)
    let [info,pool] = await this.scanInfoCell(tip)

    return [liquidityAddReqs,liquidityRemoveReqs,swapReqs,info,pool,matcherChange]
  }

  // be careful that the tip is hexicalDecimal
  scanReqs = async (tip?: string): Promise<[
    Array<LiquidityAddReq>,
    Array<LiquidityRemoveReq>,
    Array<SwapReq>
  ]> => {
    this.startIndexer()

    const swapReqCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...SWAP_REQ_QUERY_OPTION,
    })
    const swapReqs: SwapReq[] = []
    for await (const cell of swapReqCollector.collect()) {
      // change to construct
      if (isCellValid(cell)) {

        const script = await this.#rpcService.getLockScript(cell.out_point!,SwapReq.getUserLockHash(cell))
        if(!script){
          continue
        }
        swapReqs.push(new SwapReq(cell,script!))
      }
    }

    const liquidityAddReqCollector = new CellCollector(this.#indexer,
      {
        toBlock: tip,
        ...LIQUIDITY_ADD_REQ_QUERY_OPTION,
      },
    )
    const liquidityAddReqs: Array<LiquidityAddReq> = []
    for await (const cell of liquidityAddReqCollector.collect()) {
      if (isCellValid(cell)) {
        const script = await this.#rpcService.getLockScript(cell.out_point!,LiquidityAddReq.getUserLockHash(cell))
        if(!script){
          continue
        }
        liquidityAddReqs.push(new LiquidityAddReq(cell,script))
      }
    }

    const liquidityRemoveReqs: Array<LiquidityRemoveReq> = []
    const liquidityRemoveReqCollector = new CellCollector(this.#indexer,
      {
        toBlock: tip,
        ...LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
      },
    )
    for await (const cell of liquidityRemoveReqCollector.collect()) {
      if (isCellValid(cell)) {
        const script = await this.#rpcService.getLockScript(cell.out_point!,LiquidityRemoveReq.getUserLockHash(cell))
        if(!script){
          continue
        }
        liquidityRemoveReqs.push(new LiquidityRemoveReq(cell,script))
      }
    }

    return [liquidityAddReqs,liquidityRemoveReqs, swapReqs]
  }

  scanMatcherChange = async (tip?: string): Promise<MatcherChange> => {
    const MatcheSudtCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...MATCHER_SUDT_QUERY_OPTION,
    })

    for await (const cell of MatcheSudtCollector.collect()) {
      if (isCellValid(cell)) {
        return new MatcherChange(cell)
      }
    }
    throw new Error('no MatcherChange found')
  }

  scanInfoCell = async (tip?: string): Promise<[Info, Pool]> => {
    const infoCellCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...INFO_QUERY_OPTION,
    })
    let info: Info|null = null
    for await (const cell of infoCellCollector.collect()) {
      if (isCellValid(cell)) {
        info = new Info(cell)
      }
    }

    const poolCellCollector = new CellCollector(this.#indexer, {
      toBlock: tip,
      ...POOL_QUERY_OPTION,
    })
    let pool: Pool|null = null
    for await (const cell of poolCellCollector.collect()) {
      if (isCellValid(cell)) {
        pool = new Pool(cell)
      }
    }

    if(!info || !pool){
      throw new Error('info or pool not found')
    }

    return [info!, pool!]
  }
}

function isCellValid(_cell:Cell){
  return true
}
