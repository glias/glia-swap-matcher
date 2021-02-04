import { container, modules } from '../../container'
import { injectable } from 'inversify'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { MatcherChange } from '../models/cells/matcherChange'
import { Deal, DealStatus } from '../models/entities/deal.entity'
import winston, { format, transports } from 'winston'

import ScanService from './scanService'
import TaskService from './taskService'
import DealService from './dealService'
import RpcService from './rpcService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'

jest.setMock('../../utils/logger', {
  logger: winston.createLogger({
    level: 'debug',
    format: format.combine(format.simple()),
    transports: [new transports.Console({ level: 'debug' })],
  }),
})
let scanAllReturn:
  | [
      Array<LiquidityAddTransformation>,
      Array<LiquidityRemoveTransformation>,
      Array<SwapBuyTransformation>,
      Array<SwapSellTransformation>,
      Info,
      Pool,
      MatcherChange,
    ]
  | null = null

@injectable()
class MockScanService {
  scanAll = jest.fn().mockImplementation(() => {
    return Promise.resolve(scanAllReturn)
  })
  getTip = jest.fn().mockResolvedValue(1n)
}

// mocked services

let getAllSentDealsReturn: Array<Deal>
let getByTxHashReturn: Deal | null
@injectable()
class MockDealService {
  getAllSentDeals = jest.fn().mockImplementation(() => {
    return Promise.resolve(getAllSentDealsReturn)
  })
  getByPreTxHash = jest.fn().mockResolvedValue(null)
  getByTxHash = jest.fn().mockImplementation(() => {
    return Promise.resolve(getByTxHashReturn)
  })
  saveDeal = jest.fn().mockResolvedValue(null)
  updateDealStatus = jest.fn().mockResolvedValue(undefined)
  updateDealsStatus = jest.fn().mockResolvedValue(undefined)
  updateDealTxsChainsToCommited = jest.fn().mockResolvedValue(undefined)
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

//let matchSwapReturn: SwapMatch
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
}

@injectable()
class MockTransactionService {
  // @ts-ignore
  composeLiquidityInitTransaction = jest.fn().mockImplementation(() => {
    return null
  })
  // @ts-ignore
  composeLiquidityTransaction = jest.fn().mockImplementation(() => {
    return null
  })
  composeSwapTransaction = jest.fn().mockImplementation(() => {
    return null
  })

  signWitness = jest.fn().mockImplementation(() => {
    return null
  })
}

import { defaultOutPoint, defaultScript } from '../../utils/tools'
import JSONbig from 'json-bigint'
import { LiquidityAddReq } from '../models/cells/liquidityAddReq'

describe('Test tasks module', () => {
  let taskService: TaskService
  let mockScanService: MockScanService
  // let mockDealService: MockDealService
  // let mockRpcService: MockRpcService
  // let mockMatcherService: MockMatcherService
  //let spyTransactionService: TransactionService
  // let spyTask
  // let spyHandler
  // @ts-ignore
  let signWitness
  let handlerInit
  beforeAll(async () => {
    modules[ScanService.name] = Symbol(ScanService.name)
    modules[DealService.name] = Symbol(DealService.name)
    modules[RpcService.name] = Symbol(RpcService.name)
    modules[MatcherService.name] = Symbol(MatcherService.name)
    modules[TransactionService.name] = Symbol(TransactionService.name)
    modules[TaskService.name] = Symbol(TaskService.name)
    container.bind(modules[ScanService.name]).to(MockScanService)
    container.bind(modules[DealService.name]).to(MockDealService)
    container.bind(modules[RpcService.name]).to(MockRpcService)
    container.bind(modules[MatcherService.name]).to(MockMatcherService)
    container.bind(modules[TransactionService.name]).to(MockTransactionService)
    container.bind(modules[TaskService.name]).to(TaskService)

    taskService = container.get(modules[TaskService.name])
    mockScanService = container.get(modules[ScanService.name])
    // mockDealService = container.get(modules[DealService.name])
    // mockRpcService = container.get(modules[RpcService.name])
    // mockMatcherService = container.get(modules[MatcherService.name])
    // mockTransactionService = container.get(modules[TransactionService.name])

    handlerInit = jest.spyOn(taskService, 'handlerInit')
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('init liquidity, no liquidity add xforms', async () => {
    scanAllReturn = [[], [], [], [], Info.default(), Pool.default(), MatcherChange.default()]
    getByTxHashReturn = null
    getAllSentDealsReturn = []

    await taskService.task()

    expect(handlerInit).toHaveBeenCalled()
  })

  it('init liquidity, liquidity add xforms', async () => {
    scanAllReturn = [
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
            defaultOutPoint,
          ),
        ),
      ],
      [],
      [],
      [],
      Info.default(),
      Pool.default(),
      MatcherChange.default(),
    ]

    getByTxHashReturn = null
    getAllSentDealsReturn = []

    await taskService.task()

    expect(handlerInit).toHaveBeenCalled()

    console.log(JSONbig.stringify(handlerInit.mock.calls[0][0]))
  })
})
