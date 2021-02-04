import { container, modules } from '../../container'
import { injectable } from 'inversify'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { MatcherChange } from '../models/cells/matcherChange'
import {  DealStatus } from '../models/entities/deal.entity'
import winston, { format, transports } from 'winston'

import ScanService from './scanService'
import TaskService from './taskService'
import DealService from './dealService'
import RpcService from './rpcService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'
import { defaultOutPoint, defaultScript } from '../../utils/tools'
import JSONbig from 'json-bigint'
import { LiquidityAddReq } from '../models/cells/liquidityAddReq'
import { createConnection } from 'typeorm'
import { NODE_ENV } from '../../utils/envs'
import { logger } from '../../utils/logger'

jest.setMock('../../utils/logger', {
  logger: winston.createLogger({
    level: 'debug',
    format: format.combine(format.simple()),
    transports: [new transports.Console({ level: 'debug' })],
  }),
})
let scanAllReturn: [
  Array<LiquidityAddTransformation>,
  Array<LiquidityRemoveTransformation>,
  Array<SwapBuyTransformation>,
  Array<SwapSellTransformation>,
  Info,
  Pool,
  MatcherChange,
] | null = null

@injectable()
class MockScanService {
  scanAll = jest.fn().mockImplementation(() => {
    return Promise.resolve(scanAllReturn)
  })
  getTip = jest.fn().mockResolvedValue(1n)
}

let getTxsStatusReturn: Array<[string, Omit<DealStatus, DealStatus.Sent>]>

@injectable()
class MockRpcService {
  getTxsStatus = jest.fn().mockImplementation(() => {
    return Promise.resolve(getTxsStatusReturn)
  })
  getLockScript = jest.fn().mockImplementation(() => {
    return null
  })
  sendTransaction = jest.fn().mockImplementation(() => {
    return null
  })
}

/*//let matchSwapReturn: SwapMatch
//let matchLiquidityReturn: MatchRecord
@injectable()
class MockMatcherService {
  // @ts-ignore
  matchSwap = jest.fn().mockImplementation(() => {
    return null
  })
  // @ts-ignore
  matchLiquidity = jest.fn().mockImplementation(() => {
    return null
  })
  initLiquidity = jest.fn().mockImplementation(() => {
    return null
  })
}*/

/*@injectable()
class MockTransactionService {
  // @ts-ignore
  composeLiquidityInitTransaction = jest.fn().mockImplementation(() => {
    return null
  })
  // @ts-ignore
  composeTransaction = jest.fn().mockImplementation(() => {
    return null
  })
}*/

describe('Test tasks module', () => {
  let taskService: TaskService
  let mockScanService: MockScanService
  let dealService: DealService
  // let mockRpcService: MockRpcService
  // let mockMatcherService: MockMatcherService
  //let spyTransactionService: TransactionService
  // let spyTask
  // let spyHandler
  // @ts-ignore
  let signWitness
  let handlerInit
  beforeAll(async () => {

    const connection = await createConnection(NODE_ENV)
    logger.debug(`database connected to ${connection.name}`)

    modules[ScanService.name] = Symbol(ScanService.name)
    modules[DealService.name] = Symbol(DealService.name)
    modules[RpcService.name] = Symbol(RpcService.name)
    modules[MatcherService.name] = Symbol(MatcherService.name)
    modules[TransactionService.name] = Symbol(TransactionService.name)
    modules[TaskService.name] = Symbol(TaskService.name)
    container.bind(modules[ScanService.name]).to(MockScanService)
    container.bind(modules[DealService.name]).to(DealService)
    container.bind(modules[RpcService.name]).to(MockRpcService)
    container.bind(modules[MatcherService.name]).to(MatcherService)
    container.bind(modules[TransactionService.name]).to(TransactionService)
    container.bind(modules[TaskService.name]).to(TaskService)

    taskService = container.get(modules[TaskService.name])
    mockScanService = container.get(modules[ScanService.name])
    dealService = container.get(modules[DealService.name])
    // mockRpcService = container.get(modules[RpcService.name])
    // mockMatcherService = container.get(modules[MatcherService.name])
    // mockTransactionService = container.get(modules[TransactionService.name])

    handlerInit = jest.spyOn(taskService, 'handlerInit')

    await dealService.clearDb()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('init liquidity, no liquidity add xforms', async () => {
    scanAllReturn =[
      [
        new LiquidityAddTransformation(
          new LiquidityAddReq(
            BigInt(100 * 10 ** 8) + LiquidityAddReq.LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY,
            BigInt(100 * 10 ** 8),
            '0000000000000000000000000000000000000000000000000000000000000000',
            '01',
            BigInt(0 * 10 ** 8),
            BigInt(0 * 10 ** 8),
            '0000000000000000000000000000000000000000000000000000000000000000',
            BigInt(0 * 10 ** 8),
            BigInt(0 * 10 ** 8),
            defaultScript,
            {
              tx_hash: '0x3333333333333333333333333333333333333333333333333333333333333300',
              index: '0x1',
            },
          ),
        ),
      ],
      [],
      [],
      [],
      new Info(Info.INFO_FIXED_CAPACITY,
        BigInt(100 * 10 ** 8),
        BigInt(100 * 10 ** 8),
        BigInt(100 * 10 ** 8),
        {
          tx_hash: '0x1111111111111111111111111111111111111111111111111111111111111100',
          index: '0x0',
        }
      ),
      new Pool(Pool.POOL_FIXED_CAPACITY + BigInt(100 * 10 ** 8),
        BigInt(100 * 10 ** 8),
        {
          tx_hash: '0x1111111111111111111111111111111111111111111111111111111111111100',
          index: '0x1',
        }
      ),
      MatcherChange.default(),
    ]

    await taskService.task()
    // tx 0x189007b340c557699fa2fc5c7ed5d7cb46553bb8a79e1a22ff4e42198e9bf4da is sent
    expect(handlerInit).toHaveBeenCalled()
  })
  it('one is pending and get one more', async () => {

    let deal = await dealService.getAllSentDeals()!

    scanAllReturn =[
      [
        new LiquidityAddTransformation(
          new LiquidityAddReq(
            BigInt(100 * 10 ** 8) + LiquidityAddReq.LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY,
            BigInt(100 * 10 ** 8),
            '0000000000000000000000000000000000000000000000000000000000000000',
            '01',
            BigInt(0 * 10 ** 8),
            BigInt(0 * 10 ** 8),
            '0000000000000000000000000000000000000000000000000000000000000000',
            BigInt(0 * 10 ** 8),
            BigInt(0 * 10 ** 8),
            defaultScript,
            {
              tx_hash: '0x3333333333333333333333333333333333333333333333333333333333333300',
              index: '0x1',
            },
          ),
        ),
        new LiquidityAddTransformation(
          new LiquidityAddReq(
            BigInt(100 * 10 ** 8) + LiquidityAddReq.LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY,
            BigInt(100 * 10 ** 8),
            '0000000000000000000000000000000000000000000000000000000000000000',
            '01',
            BigInt(0 * 10 ** 8),
            BigInt(0 * 10 ** 8),
            '0000000000000000000000000000000000000000000000000000000000000000',
            BigInt(0 * 10 ** 8),
            BigInt(0 * 10 ** 8),
            defaultScript,
            {
              tx_hash: '0x3333333333333333333333333333333333333333333333333333333333333301',
              index: '0x1',
            },
          ),
        ),
      ],
      [],
      [],
      [],
      new Info(Info.INFO_FIXED_CAPACITY,
        BigInt(100 * 10 ** 8),
        BigInt(100 * 10 ** 8),
        BigInt(100 * 10 ** 8),
        {
          tx_hash: '0x1111111111111111111111111111111111111111111111111111111111111100',
          index: '0x0',
        }
      ),
      new Pool(Pool.POOL_FIXED_CAPACITY + BigInt(100 * 10 ** 8),
        BigInt(100 * 10 ** 8),
        {
          tx_hash: '0x1111111111111111111111111111111111111111111111111111111111111100',
          index: '0x1',
        }
      ),
      MatcherChange.default(),
    ]

    await taskService.task()

  })

})
