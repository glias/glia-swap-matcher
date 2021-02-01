import { CellCollector, Indexer } from '@ckb-lumos/sql-indexer'
import knex from 'knex'
import {
  INDEXER_MYSQL_DATABASE,
  INDEXER_MYSQL_PASSWORD,
  INDEXER_MYSQL_URL,
  INDEXER_MYSQL_URL_PORT,
  INDEXER_MYSQL_USERNAME,
  INDEXER_URL,
  INFO_QUERY_OPTION,
  LIQUIDITY_ADD_REQ_QUERY_OPTION,
  LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
  MATCHER_QUERY_OPTION,
  POOL_QUERY_OPTION,
  SWAP_BUY_REQ_QUERY_OPTION,
  SWAP_SELL_REQ_QUERY_OPTION,
} from '../../utils/envs'
import { SwapBuyReq } from '../models/cells/swapBuyReq'
import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { LiquidityRemoveReq } from '../models/cells/liquidityRemoveReq'
import { LiquidityAddReq } from '../models/cells/liquidityAddReq'
import { MatcherChange } from '../models/cells/matcherChange'
import RpcService from './rpcService'
import { modules } from '../../container'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { SwapSellReq } from '../models/cells/swapSellReq'
import { bigIntToHex } from '../../utils/tools'
import JSONbig from 'json-bigint'
import { logger } from '../../utils/logger'

@injectable()
export default class ScanService {
  readonly #indexer!: Indexer
  readonly #rpcService: RpcService
  readonly #knex: knex

  #info = (msg: string) => {
    logger.info(`ScanService: ${msg}`)
  }
  // @ts-ignore
  #error = (msg: string) => {
    logger.error(`ScanService: ${msg}`)
  }


  constructor(@inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService) {
    this.#rpcService = rpcService

    this.#knex =  knex({
      client: 'mysql',
      connection: {
        host: INDEXER_MYSQL_URL,
        port: INDEXER_MYSQL_URL_PORT,
        user: INDEXER_MYSQL_USERNAME,
        password: INDEXER_MYSQL_PASSWORD,
        database: INDEXER_MYSQL_DATABASE,
      },
    });

    this.#indexer = new Indexer(INDEXER_URL, this.#knex)
  }

  getTip = async (): Promise<bigint> => {
    return BigInt((await this.#indexer.tip()).block_number)
  }

  scanAll = async (): Promise<
    | [
        Array<LiquidityAddTransformation>,
        Array<LiquidityRemoveTransformation>,
        Array<SwapBuyTransformation>,
        Array<SwapSellTransformation>,
        Info,
        Pool,
        MatcherChange,
      ]
    | null
  > => {
    const tip = bigIntToHex(await this.getTip())

    let [liquidityAddReqs, liquidityRemoveReqs, swapBuyReqs, swapSellReqs] = await this.scanReqs(tip)
    let matcherChange = await this.scanMatcherChange(tip)
    let [info, pool] = await this.scanInfoCell(tip)

    let liquidityAddTransformations = liquidityAddReqs.map(req => new LiquidityAddTransformation(req))
    let liquidityRemoveTransformations = liquidityRemoveReqs.map(req => new LiquidityRemoveTransformation(req))
    let swapBuyTransformations = swapBuyReqs.map(req => new SwapBuyTransformation(req))
    let swapSellTransformations = swapSellReqs.map(req => new SwapSellTransformation(req))

    return [
      liquidityAddTransformations,
      liquidityRemoveTransformations,
      swapBuyTransformations,
      swapSellTransformations,
      info,
      pool,
      matcherChange,
    ]
  }

  // be careful that the tip is hexicalDecimal
  scanReqs = async (
    tip?: string,
  ): Promise<[Array<LiquidityAddReq>, Array<LiquidityRemoveReq>, Array<SwapBuyReq>, Array<SwapSellReq>]> => {
    const swapBuyReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...SWAP_BUY_REQ_QUERY_OPTION,
    })
    const swapBuyReqs: SwapBuyReq[] = []
    for await (const cell of swapBuyReqCollector.collect()) {
      // change to construct

      const script = await this.#rpcService.getLockScript(cell.out_point!, SwapBuyReq.getUserLockHash(cell))
      if (!script) {
        continue
      }
      swapBuyReqs.push(new SwapBuyReq(cell, script!))
    }
    //==============

    const swapSellReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...SWAP_SELL_REQ_QUERY_OPTION,
    })
    const swapSellReqs: SwapSellReq[] = []
    for await (const cell of swapSellReqCollector.collect()) {
      // change to construct

      const script = await this.#rpcService.getLockScript(cell.out_point!, SwapSellReq.getUserLockHash(cell))
      if (!script) {
        continue
      }
      swapSellReqs.push(new SwapSellReq(cell, script!))
    }

    //==============
    const liquidityAddReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...LIQUIDITY_ADD_REQ_QUERY_OPTION,
    })
    const liquidityAddReqs: Array<LiquidityAddReq> = []
    for await (const cell of liquidityAddReqCollector.collect()) {
      const script = await this.#rpcService.getLockScript(cell.out_point!, LiquidityAddReq.getUserLockHash(cell))
      if (!script) {
        continue
      }
      liquidityAddReqs.push(new LiquidityAddReq(cell, script))
    }

    //==============
    const liquidityRemoveReqs: Array<LiquidityRemoveReq> = []
    const liquidityRemoveReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
    })
    for await (const cell of liquidityRemoveReqCollector.collect()) {
      const script = await this.#rpcService.getLockScript(cell.out_point!, LiquidityRemoveReq.getUserLockHash(cell))
      if (!script) {
        continue
      }
      liquidityRemoveReqs.push(new LiquidityRemoveReq(cell, script))
    }

    return [liquidityAddReqs, liquidityRemoveReqs, swapBuyReqs, swapSellReqs]
  }

  scanMatcherChange = async (tip?: string): Promise<MatcherChange> => {
    const MatcherCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...MATCHER_QUERY_OPTION,
    })
    let matcherChange: MatcherChange | null = null
    for await (const cell of MatcherCollector.collect()) {
      matcherChange = MatcherChange.fromCell(cell)
      break
    }
    if (!matcherChange) {
      throw new Error('matcher change not found')
    }

    return matcherChange
  }

  scanInfoCell = async (tip?: string): Promise<[Info, Pool]> => {
    const infoCellCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...INFO_QUERY_OPTION,
    })
    let info: Info | null = null
    for await (const cell of infoCellCollector.collect()) {
      info = Info.fromCell(cell)
      this.#info('info cell: ' + JSONbig.stringify(info, null, 2))
      break
    }


    const poolCellCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...POOL_QUERY_OPTION,
    })
    let pool: Pool | null = null
    for await (const cell of poolCellCollector.collect()) {
      this.#info("pool cell: "+ JSONbig.stringify(cell,null,2))
      pool = Pool.fromCell(cell)
      break
    }

    if (!info || !pool) {
      throw new Error('info or pool not found')
    }

    return [info!, pool!]
  }
}
