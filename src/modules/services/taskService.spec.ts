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
import { SwapMatch } from '../models/matches/swapMatch'
import { LiquidityMatch } from '../models/matches/liquidityMatch'
import winston, { format, transports } from 'winston'

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
// let scanAllReturn :[
//   Array<LiquidityAddTransformation>,
//   Array<LiquidityRemoveTransformation>,
//   Array<SwapBuyTransformation>,
//   Array<SwapSellTransformation>,
//   Info,
//   Pool,
//   MatcherChange,
// ]

// jest.doMock(
//   './scanService',
//   ()=> injectable()( class ScanService{
//       static scanAllReturn :[
//         Array<LiquidityAddTransformation>,
//         Array<LiquidityRemoveTransformation>,
//         Array<SwapBuyTransformation>,
//         Array<SwapSellTransformation>,
//         Info,
//         Pool,
//         MatcherChange,
//       ]|null=null
//
//       scanAll = jest.fn().mockResolvedValue(ScanService.scanAllReturn);
//       getTip = jest.fn().mockResolvedValue(1n);
//       hello = jest.fn().mockReturnValue(
//         [1,2,3]
//       )
//   })
// )

@injectable()
class MockScanService {
  scanAllReturn:
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

  input: Array<Number> = [0]

  scanAll = jest.fn().mockImplementation(() => {
    return Promise.resolve(this.scanAllReturn)
  })
  getTip = jest.fn().mockResolvedValue(1n)
}

// mocked services

let getAllSentDealsReturn: Array<Deal>
let getByTxHashReturn: Deal
@injectable()
class MockDealService {
  getAllSentDeals = jest.fn().mockResolvedValue(getAllSentDealsReturn)
  getByPreTxHash = jest.fn().mockResolvedValue(null)
  getByTxHash = jest.fn().mockResolvedValue(getByTxHashReturn)
  saveDeal = jest.fn().mockResolvedValue(null)
  updateDealStatus = jest.fn().mockResolvedValue(undefined)
  updateDealsStatus = jest.fn().mockResolvedValue(undefined)
  updateDealTxsChainsToCommited = jest.fn().mockResolvedValue(undefined)
}

let getTxsStatusReturn: Array<[string, Omit<DealStatus, DealStatus.Sent>]>
@injectable()
class MockRpcService {
  getTxsStatus = jest.fn().mockResolvedValue(getTxsStatusReturn)
  getLockScript = jest.fn().mockResolvedValue(undefined)
  sendTransaction = jest.fn().mockResolvedValue(undefined)
}

let matchSwapReturn: SwapMatch
let matchLiquidityReturn: LiquidityMatch
@injectable()
class MockMatcherService {
  // @ts-ignore
  matchSwap = jest.fn().mockImplementation(input => {
    input = matchSwapReturn
  })
  // @ts-ignore
  matchLiquidity = jest.fn().mockImplementation(input => {
    input = matchLiquidityReturn
  })
  initLiquidity = jest.fn().mockImplementation(input => input)
}

import ScanService from './scanService'

describe('Test tasks module', () => {
  let taskService: TaskService
  let mockScanService: MockScanService
  // let mockDealService: MockDealService
  // let mockRpcService: MockRpcService
  // let mockMatcherService: MockMatcherService
  let spyTransactionService: TransactionService
  // let spyTask
  // let spyHandler

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
    container.bind(modules[TransactionService.name]).to(TransactionService)
    container.bind(modules[TaskService.name]).to(TaskService)

    taskService = container.get(modules[TaskService.name])
    mockScanService = container.get(modules[ScanService.name])
    // mockDealService = container.get(modules[DealService.name])
    // mockRpcService = container.get(modules[RpcService.name])
    // mockMatcherService = container.get(modules[MatcherService.name])
    spyTransactionService = container.get(modules[TransactionService.name])
    jest.spyOn(spyTransactionService, 'signWitness').mockReturnValue('0x1234')
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('do it', async () => {
    mockScanService.input = [1, 2, 3, 4]
    mockScanService.scanAllReturn = [[], [], [], [], Info.default(), Pool.default(), MatcherChange.default()]
    await taskService.task()
  })
})
