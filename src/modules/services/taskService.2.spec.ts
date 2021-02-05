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
import DealRepository from '../repositories/deal.repository'

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

let getTxsStatusReturnStatus = DealStatus.Sent
@injectable()
class MockRpcService {
  getTxsStatus = jest.fn().mockImplementation((txHashes: Array<string>) => {
    const ret = txHashes.map((hash) =>{return [hash,getTxsStatusReturnStatus]})
    return Promise.resolve(ret)
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
    //jest.clearAllMocks()
  })

  it('save deal', async ()=>{
    await dealService.saveDeal({
      txHash: '0x7c603c9df830c0c59b3524417de5197da3fc49b00e255fff0ba3fbc883d786ac',
      preTxHash: '0x1111111111111111111111111111111111111111111111111111111111111100',
      tx:'{"version":"0x0","headerDeps":[],"cellDeps":[{"outPoint":{"txHash":"0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0x9b4b038fa701001ee8b2898880f3cb9a9ad8acea3352a0476381c07edf38b83d","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0xbc050cd03f79232ab36a03f1f66a606c7c25fc8794fe0a642bf77c6b5cda5b1f","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0x26988bb050e3e6c9e5b96a839fd1a1ee4ce389c50a01826b04c60dacbc081671","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0x80151855e5041081959a4c72cbccd73bd114439c099e20308a0a8dd7a3b533dd","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37","index":"0x0"},"depType":"depGroup"}],"inputs":[{"previousOutput":{"txHash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x0"},"since":"0x0"},{"previousOutput":{"txHash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x1"},"since":"0x0"},{"previousOutput":{"txHash":"0x1111111111111111111111111111111111111111111111111111111111111111","index":"0x0"},"since":"0x0"},{"previousOutput":{"txHash":"0x3333333333333333333333333333333333333333333333333333333333333300","index":"0x1"},"since":"0x0"}],"witnesses":["0x1c00000010000000100000001c000000080000000000000000000000","0x","0x5500000010000000550000005500000041000000aad8b1d1c5fdfeadb65ecf777cae880dcfc9da00b509e241876b52dd829e8128113231a302eb66cc595f0c543e34d66caab06ddae4636f0f6d77c0e7e9611fee01","0x"],"outputs":[{"capacity":"0x5d21dba00","type":{"codeHash":"0xb31869abb8b9f2f62bbb89ad89e525fa39b54ee57383a53949a89d80fc468929","hashType":"data","args":"0x0000000000000000000000000000000000000000000000000000000000000016"},"lock":{"codeHash":"0x74f5bee3f3ebc5ff31dbeb4da1b37099dfde61fe5f251375fe3ca9618542cca2","hashType":"data","args":"0xbfb315567328439666a3a56a3f5cf7ea671142c24189404c306c5ffd5a3a11d0e6b60edd8c90130829a2ee360c356069aba738fae25b9f89ebe3fbb31e5076a6"}},{"capacity":"0x749a01900","type":{"codeHash":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","hashType":"type","args":"0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902"},"lock":{"codeHash":"0x74f5bee3f3ebc5ff31dbeb4da1b37099dfde61fe5f251375fe3ca9618542cca2","hashType":"data","args":"0xbfb315567328439666a3a56a3f5cf7ea671142c24189404c306c5ffd5a3a11d0e6b60edd8c90130829a2ee360c356069aba738fae25b9f89ebe3fbb31e5076a6"}},{"capacity":"0x1b31d2900","type":null,"lock":{"codeHash":"0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8","hashType":"type","args":"0x7e5cb4abd670e6f9c1bd925fe12cb1bec51b35e7"}},{"capacity":"0x395e95a00","type":{"codeHash":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","hashType":"type","args":"0x0cd23f2e82f785ba11dcd46554d01b8f527aa397e479da9c7a697fa72aab4721"},"lock":{"args":"0x","codeHash":"0x0000000000000000000000000000000000000000000000000000000000000000","hashType":"data"}},{"capacity":"0x395e95a00","type":{"codeHash":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","hashType":"type","args":"0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902"},"lock":{"args":"0x","codeHash":"0x0000000000000000000000000000000000000000000000000000000000000000","hashType":"data"}}],"outputsData":["0x009ffaf4020000000000000000000000019ffaf4020000000000000000000000019ffaf40200000000000000000000003ecc589fd5838c71dc2e607c887dde781090fdea736214bb7485d2d43b911851","0x019ffaf4020000000000000000000000","0x","0x01bbeea0000000000000000000000000","0xff281db3010000000000000000000000"]}',
      info:'{"capacity":25000000000,"ckbReserve":12700000000,"sudtReserve":12700000001,"totalLiquidity":12700000001,"ckbReserveOriginal":10000000000,"sudtReserveOriginal":10000000000,"totalLiquidityOriginal":10000000000,"outPoint":{"tx_hash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x0"}}',
      pool:'{"capacity":31300000000,"sudtAmount":12700000001,"capacityOriginal":28600000000,"sudtReserveOriginal":10000000000,"outPoint":{"tx_hash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x1"}}',
      matcherChange:'{"capacity":7300000000,"ckbReserveOriginal":0,"outPoint":{"tx_hash":"0x1111111111111111111111111111111111111111111111111111111111111111","index":"0x0"}}',
      reqOutpoints:'0x3333333333333333333333333333333333333333333333333333333333333300-0x1',
      status:0
    })

    const ret = await dealService.getAllSentDeals()

    await dealService.clearDb()
  })

  it('add liquidity', async () => {
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

    getTxsStatusReturnStatus = DealStatus.Sent

    await taskService.task()
    console.log()
    //expect(handlerInit).toHaveBeenCalled()
  })



  it('one is pending and add one more', async () => {

    let deal = await dealService.getAllSentDeals()!
    expect(deal.length).toEqual(1)
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

    deal = await dealService.getAllSentDeals()!
    expect(deal.length).toEqual(2)
  })

  it('new request comes and old 2 reqs are committed', async () => {

  })
})
