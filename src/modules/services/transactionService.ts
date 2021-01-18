import { injectable } from 'inversify'
import { LiquidityRemoveRes } from '../models/liquidityRemoveRes'
import { LiquidityAddRes } from '../models/liquidityAddRes'
import { Info } from '../models/info'
import { Pool } from '../models/pool'
import { MatcherChange } from '../models/matcherChange'
import { bigIntTo128LeHex, getCellFromRawTransaction, scriptSnakeToCamel } from '../../utils/tools'
import {
  ALL_CELL_DEPS,
  BLOCK_MINER_FEE,
  DEFAULT_NODE_URL,
  LPT_TYPE_SCRIPT,
  PRIVATE_KEY,
  SUDT_TYPE_SCRIPT,
} from '../../utils'
import { Sudt } from '../models/sudt'
import { Ckb } from '../models/ckb'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { SwapRes } from '../models/swapRes'

@injectable()
export default class TransactionService {
  readonly #ckb: CKB

  constructor() {
    this.#ckb = new CKB(DEFAULT_NODE_URL)
  }

  /*
    info_in_cell                            info_out_cell
    pool_in_cell                            pool_out_cell
                              ------->
    matcher_in_cell                         matcher_out_cell
    [removed_liquidity_cell]                [sudt_cell]
    [add_liquidity_cell]                    [liquidity_cell and change_cell]
   */
  composeLiquidityTransaction = (removeReses: Array<LiquidityRemoveRes>,
                                 addReses: Array<LiquidityAddRes>,
                                 info: Info,
                                 pool: Pool,
                                 matcherChange: MatcherChange)
    : [CKBComponents.RawTransaction,string,Info,Pool,MatcherChange] | null=> {
    if(!removeReses.length&& !addReses.length){
      return null
    }

    const inputs: CKBComponents.CellInput[] = []
    const outputs: CKBComponents.CellOutput[] = []
    const outputsData: string[] = []

    // first we insert info cell
    {
      const infoInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: info.rawCell.out_point!.tx_hash,
          index: info.rawCell.out_point!.index,
        },
        since: '0x00',
      }

      // the info's capacity, type and lock scripts should not change
      const infoOutput: CKBComponents.CellOutput = {
        capacity: bigIntTo128LeHex(info.capacity),
        type: scriptSnakeToCamel(info.rawCell.cell_output.type!),
        lock: scriptSnakeToCamel(info.rawCell.cell_output.lock),
      }

      const infoOutputData = info.toCellData()

      inputs.push(infoInput)
      outputs.push(infoOutput)
      outputsData.push(infoOutputData)
    }// first

    // second we insert pool cell
    {
      const poolInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: pool.rawCell.out_point!.tx_hash,
          index: pool.rawCell.out_point!.index,
        },
        since: '0x00',
      }

      // the pool's type and lock scripts should not change
      const poolOutput: CKBComponents.CellOutput = {
        capacity: bigIntTo128LeHex(pool.capacity),
        type: scriptSnakeToCamel(pool.rawCell.cell_output.type!),
        lock: scriptSnakeToCamel(pool.rawCell.cell_output.lock),
      }

      const poolOutputData = pool.toCellData()

      inputs.push(poolInput)
      outputs.push(poolOutput)
      outputsData.push(poolOutputData)
    }// second

    // third, the matcher change doesn't change in liquidity tx
    {
      const matcherChangeInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: matcherChange.rawCell.out_point!.tx_hash,
          index: matcherChange.rawCell.out_point!.index,
        },
        since: '0x00',
      }

      // the matcherChange's type and lock scripts should not change

      // eliminate block miner fee
      if ((matcherChange.capacity - BLOCK_MINER_FEE) < 0n) {
        return null
      }

      const matcherChangeOutput: CKBComponents.CellOutput = {
        capacity: bigIntTo128LeHex(matcherChange.capacity - BLOCK_MINER_FEE),
        type: scriptSnakeToCamel(matcherChange.rawCell.cell_output.type!),
        lock: scriptSnakeToCamel(matcherChange.rawCell.cell_output.lock),
      }

      const matcherChangeOutputData = matcherChange.toCellData()

      inputs.push(matcherChangeInput)
      outputs.push(matcherChangeOutput)
      outputsData.push(matcherChangeOutputData)
    }// third

    // fourth, compose remove liquidity requests
    {
      for (let removeRes of removeReses) {
        const removeInput: CKBComponents.CellInput = {
          previousOutput: {
            txHash: removeRes.request.rawCell.out_point!.tx_hash,
            index: removeRes.request.rawCell.out_point!.index,
          },
          since: '0x00',
        }

        // sudt
        const sudt: Sudt = removeRes.toCell()
        const removeOutput: CKBComponents.CellOutput = {
          capacity: bigIntTo128LeHex(sudt.capacity),
          type: SUDT_TYPE_SCRIPT,
          lock: removeRes.request.originalUserLock,
        }

        const removeOutputData = sudt.toCellData()
        inputs.push(removeInput)
        outputs.push(removeOutput)
        outputsData.push(removeOutputData)
      }
    }// fourth

    // fifth, compose add liquidity requests
    {
      for (let addRes of addReses) {
        const addInput: CKBComponents.CellInput = {
          previousOutput: {
            txHash: addRes.request.rawCell.out_point!.tx_hash,
            index: addRes.request.rawCell.out_point!.index,
          },
          since: '0x00',
        }

        // Lpt and Sudt/Ckb cell
        let [lpt, sudtOrCkb] = addRes.toCells()

        // first handle lpt
        const lptOutput: CKBComponents.CellOutput = {
          capacity: bigIntTo128LeHex(lpt.capacity),
          type: LPT_TYPE_SCRIPT,
          lock: addRes.request.originalUserLock,
        }

        const lptOutputData = lpt.toCellData()
        inputs.push(addInput)
        outputs.push(lptOutput)
        outputsData.push(lptOutputData)


        if (sudtOrCkb instanceof Sudt) {
          const sudt: Sudt = sudtOrCkb

          const sudtOutput: CKBComponents.CellOutput = {
            capacity: bigIntTo128LeHex(sudt.capacity),
            type: SUDT_TYPE_SCRIPT,
            lock: addRes.request.originalUserLock,
          }

          const sudtOutputData = sudt.toCellData()
          outputs.push(sudtOutput)
          outputsData.push(sudtOutputData)
        } else {
          const ckb: Ckb = sudtOrCkb
          const ckbOutput: CKBComponents.CellOutput = {
            capacity: bigIntTo128LeHex(ckb.capacity),
            type: null,
            lock: addRes.request.originalUserLock,
          }

          const ckbOutputData = ckb.toCellData()
          inputs.push(addInput)
          outputs.push(ckbOutput)
          outputsData.push(ckbOutputData)
        }
      }
    }// fifth

    // compose tx
    const rawTx: CKBComponents.RawTransaction = {
      version: '0x0',
      headerDeps: [],
      cellDeps: ALL_CELL_DEPS,
      inputs: inputs,
      witnesses: new Array(inputs.length).fill('0x'),
      outputs: outputs,
      outputsData: outputsData,
    }

    const [signedTx,txHash] = this.signTransaction(rawTx)

    const new_info = new Info(getCellFromRawTransaction(signedTx,txHash,0))
    const new_pool = new Pool(getCellFromRawTransaction(signedTx,txHash,1))
    const new_matcherChange = new MatcherChange(getCellFromRawTransaction(signedTx,txHash,2))
    return [signedTx,txHash,new_info,new_pool,new_matcherChange]
  }

  /*
  info_in_cell                            info_out_cell
  pool_in_cell                            pool_out_cell
                            ------->
  matcher_in_cell                         matcher_out_cell
  [swap_order_cell]                       [sudt_cell/free_cell]
 */
  composeSwapTransaction = (swapReses:Array<SwapRes>,
                                 info: Info,
                                 pool: Pool,
                                 matcherChange: MatcherChange)
    : [CKBComponents.RawTransaction,string,Info,Pool,MatcherChange] | null=> {
    if(!swapReses.length){
      return null
    }
    const inputs: CKBComponents.CellInput[] = []
    const outputs: CKBComponents.CellOutput[] = []
    const outputsData: string[] = []

    // first we insert info cell
    {
      const infoInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: info.rawCell.out_point!.tx_hash,
          index: info.rawCell.out_point!.index,
        },
        since: '0x00',
      }

      // the info's capacity, type and lock scripts should not change
      const infoOutput: CKBComponents.CellOutput = {
        capacity: bigIntTo128LeHex(info.capacity),
        type: scriptSnakeToCamel(info.rawCell.cell_output.type!),
        lock: scriptSnakeToCamel(info.rawCell.cell_output.lock),
      }

      const infoOutputData = info.toCellData()

      inputs.push(infoInput)
      outputs.push(infoOutput)
      outputsData.push(infoOutputData)
    }// first

    // second we insert pool cell
    {
      const poolInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: pool.rawCell.out_point!.tx_hash,
          index: pool.rawCell.out_point!.index,
        },
        since: '0x00',
      }

      // the pool's type and lock scripts should not change
      const poolOutput: CKBComponents.CellOutput = {
        capacity: bigIntTo128LeHex(pool.capacity),
        type: scriptSnakeToCamel(pool.rawCell.cell_output.type!),
        lock: scriptSnakeToCamel(pool.rawCell.cell_output.lock),
      }

      const poolOutputData = pool.toCellData()

      inputs.push(poolInput)
      outputs.push(poolOutput)
      outputsData.push(poolOutputData)
    }// second

    // third, the matcher change doesn't change in liquidity tx
    {
      const matcherChangeInput: CKBComponents.CellInput = {
        previousOutput: {
          txHash: matcherChange.rawCell.out_point!.tx_hash,
          index: matcherChange.rawCell.out_point!.index,
        },
        since: '0x00',
      }

      // the matcherChange's type and lock scripts should not change

      // eliminate block miner fee
      if ((matcherChange.capacity - BLOCK_MINER_FEE) < 0n) {
        return null
      }

      const matcherChangeOutput: CKBComponents.CellOutput = {
        capacity: bigIntTo128LeHex(matcherChange.capacity - BLOCK_MINER_FEE),
        type: scriptSnakeToCamel(matcherChange.rawCell.cell_output.type!),
        lock: scriptSnakeToCamel(matcherChange.rawCell.cell_output.lock),
      }

      const matcherChangeOutputData = matcherChange.toCellData()

      inputs.push(matcherChangeInput)
      outputs.push(matcherChangeOutput)
      outputsData.push(matcherChangeOutputData)
    }// third

    // fourth, compose remove liquidity requests
    {
      for (let swapRes of swapReses) {
        const swapInput: CKBComponents.CellInput = {
          previousOutput: {
            txHash: swapRes.request.rawCell.out_point!.tx_hash,
            index: swapRes.request.rawCell.out_point!.index,
          },
          since: '0x00',
        }

        inputs.push(swapInput)

        // sudt or ckb
        const sudtOrCkb: Sudt|Ckb = swapRes.toCell()
        if (sudtOrCkb instanceof Sudt) {
          const sudt :Sudt = sudtOrCkb
          const swapOutput: CKBComponents.CellOutput = {
            capacity: bigIntTo128LeHex(sudt.capacity),
            type: SUDT_TYPE_SCRIPT,
            lock: sudt.originalUserLock!,
          }
          const swapOutputData = sudt.toCellData()

          outputs.push(swapOutput)
          outputsData.push(swapOutputData)
        }else{
          const ckb :Ckb = sudtOrCkb
          const swapOutput: CKBComponents.CellOutput = {
            capacity: bigIntTo128LeHex(ckb.capacity),
            type: null,
            lock: ckb.originalUserLock!,
          }
          const swapOutputData = ckb.toCellData()

          outputs.push(swapOutput)
          outputsData.push(swapOutputData)
        }
      }
    }// fourth

    // compose tx
    const rawTx: CKBComponents.RawTransaction = {
      version: '0x0',
      headerDeps: [],
      cellDeps: ALL_CELL_DEPS,
      inputs: inputs,
      witnesses: new Array(inputs.length).fill('0x'),
      outputs: outputs,
      outputsData: outputsData,
    }

    const [signedTx,txHash] = this.signTransaction(rawTx)

    const new_info = new Info(getCellFromRawTransaction(signedTx,txHash,0))
    const new_pool = new Pool(getCellFromRawTransaction(signedTx,txHash,1))
    const new_matcherChange = new MatcherChange(getCellFromRawTransaction(signedTx,txHash,2))
    return [signedTx,txHash,new_info,new_pool,new_matcherChange]
  }

  signTransaction = (rawTransaction: CKBComponents.RawTransactionToSign )
    :[CKBComponents.RawTransaction, string] => {
    const txHash = this.#ckb.utils.rawTransactionToHash(rawTransaction)
    const witness = this.#ckb.signWitnesses(PRIVATE_KEY)({
      transactionHash: txHash,
      witnesses: [{ lock: '', inputType: '', outputType: '' }],
    })[0]

    const signedTx: any = {
      ...rawTransaction,
      witnesses: [witness, ...rawTransaction.witnesses.slice(1)]
    }
    return  [signedTx,txHash]
  }
}
