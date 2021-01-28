import { injectable } from 'inversify'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { MatcherChange } from '../models/cells/matcherChange'
import { ALL_CELL_DEPS, CKB_NODE_URL, MATCHER_PRIVATE_KEY } from '../../utils/envs'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { LiquidityMatch } from '../models/matches/liquidityMatch'
import { SwapMatch } from '../models/matches/swapMatch'

/*
this service compose tx for rpc
 */
@injectable()
export default class TransactionService {
  readonly #ckb: CKB

  constructor() {
    this.#ckb = new CKB(CKB_NODE_URL)
  }

  composeLiquidityTransaction = (liquidityMatch: LiquidityMatch): [Info, Pool, MatcherChange] => {
    if (!liquidityMatch.skip) {
      return [liquidityMatch.info, liquidityMatch.pool, liquidityMatch.matcherChange]
    }
    const inputs: Array<CKBComponents.CellInput> = []
    let outputs: Array<CKBComponents.CellOutput> = []
    let outputsData: Array<string> = []

    inputs.push(liquidityMatch.info.toCellInput())
    outputs.push(liquidityMatch.info.toCellOutput())
    outputsData.push(liquidityMatch.info.toCellOutputData())

    inputs.push(liquidityMatch.pool.toCellInput())
    outputs.push(liquidityMatch.pool.toCellOutput())
    outputsData.push(liquidityMatch.pool.toCellOutputData())

    inputs.push(liquidityMatch.matcherChange.toCellInput())
    outputs.push(liquidityMatch.matcherChange.toCellOutput())
    outputsData.push(liquidityMatch.matcherChange.toCellOutputData())

    for (let removeXform of liquidityMatch.removeXforms) {
      if (removeXform.skip) {
        continue
      }

      inputs.push(removeXform.toCellInput())
      outputs = outputs.concat(removeXform.toCellOutput())
      outputsData = outputsData.concat(removeXform.toCellOutputData())
    }

    for (let addXform of liquidityMatch.addXforms) {
      if (addXform.skip) {
        continue
      }

      inputs.push(addXform.toCellInput())
      outputs = outputs.concat(addXform.toCellOutput())
      outputsData = outputsData.concat(addXform.toCellOutputData())
    }

    // compose tx
    const [signedTx, txHash] = this.composeTxAndSign(inputs, outputs, outputsData)

    liquidityMatch.composedTx = signedTx
    liquidityMatch.composedTxHash = txHash

    return [
      Info.cloneWith(liquidityMatch.info, txHash, '0x00'),
      Pool.cloneWith(liquidityMatch.pool, txHash, '0x01'),
      MatcherChange.cloneWith(liquidityMatch.matcherChange, txHash, '0x02'),
    ]
  }

  /*
  info_in_cell                            info_out_cell
  pool_in_cell                            pool_out_cell
                            ------->
  matcher_in_cell                         matcher_out_cell
  [swap_order_cell]                       [sudt_cell/free_cell]
 */
  composeSwapTransaction = (swapMatch: SwapMatch): void => {
    if (!swapMatch.skip) {
      return
    }
    const inputs: Array<CKBComponents.CellInput> = []
    let outputs: Array<CKBComponents.CellOutput> = []
    let outputsData: Array<string> = []

    inputs.push(swapMatch.info.toCellInput())
    outputs.push(swapMatch.info.toCellOutput())
    outputsData.push(swapMatch.info.toCellOutputData())

    inputs.push(swapMatch.pool.toCellInput())
    outputs.push(swapMatch.pool.toCellOutput())
    outputsData.push(swapMatch.pool.toCellOutputData())

    inputs.push(swapMatch.matcherChange.toCellInput())
    outputs.push(swapMatch.matcherChange.toCellOutput())
    outputsData.push(swapMatch.matcherChange.toCellOutputData())

    for (let buyXform of swapMatch.buyXforms) {
      if (buyXform.skip) {
        continue
      }

      inputs.push(buyXform.toCellInput())
      outputs = outputs.concat(buyXform.toCellOutput())
      outputsData = outputsData.concat(buyXform.toCellOutputData())
    }

    for (let sellXform of swapMatch.sellXforms) {
      if (sellXform.skip) {
        continue
      }

      inputs.push(sellXform.toCellInput())
      outputs = outputs.concat(sellXform.toCellOutput())
      outputsData = outputsData.concat(sellXform.toCellOutputData())
    }

    const [signedTx, txHash] = this.composeTxAndSign(inputs, outputs, outputsData)

    swapMatch.composedTx = signedTx
    swapMatch.composedTxHash = txHash
  }

  composeLiquidityInitTransaction = (liquidityMatch: LiquidityMatch): void => {
    const inputs: Array<CKBComponents.CellInput> = []
    let outputs: Array<CKBComponents.CellOutput> = []
    let outputsData: Array<string> = []

    inputs.push(liquidityMatch.info.toCellInput())
    outputs.push(liquidityMatch.info.toCellOutput())
    outputsData.push(liquidityMatch.info.toCellOutputData())

    inputs.push(liquidityMatch.pool.toCellInput())
    outputs.push(liquidityMatch.pool.toCellOutput())
    outputsData.push(liquidityMatch.pool.toCellOutputData())

    inputs.push(liquidityMatch.matcherChange.toCellInput())
    outputs.push(liquidityMatch.matcherChange.toCellOutput())
    outputsData.push(liquidityMatch.matcherChange.toCellOutputData())

    inputs.push(liquidityMatch.initXforms!.toCellInput())
    outputs = outputs.concat(liquidityMatch.initXforms!.toCellOutput())
    outputsData = outputsData.concat(liquidityMatch.initXforms!.toCellOutputData())

    const [signedTx, txHash] = this.composeTxAndSign(inputs, outputs, outputsData)
    console.log('composed tx: ' + JSON.stringify(signedTx, null, 2))

    liquidityMatch.composedTx = signedTx
    liquidityMatch.composedTxHash = txHash
  }

  composeTxAndSign = (
    inputs: Array<CKBComponents.CellInput>,
    outputs: Array<CKBComponents.CellOutput>,
    outputsData: Array<string>,
  ): [CKBComponents.RawTransaction, string] => {
    const rawTx: CKBComponents.RawTransaction = {
      version: '0x0',
      headerDeps: [],
      cellDeps: ALL_CELL_DEPS,
      inputs: inputs,
      witnesses: new Array(inputs.length).fill('0x'),
      outputs: outputs,
      outputsData: outputsData,
    }

    return this.signTransaction(rawTx)
  }

  signTransaction = (rawTransaction: CKBComponents.RawTransactionToSign): [CKBComponents.RawTransaction, string] => {
    const txHash = this.#ckb.utils.rawTransactionToHash(rawTransaction)
    const witness = this.#ckb.signWitnesses(MATCHER_PRIVATE_KEY)({
      transactionHash: txHash,
      witnesses: [{ lock: '', inputType: '', outputType: '' }],
    })[0]

    const signedTx: any = {
      ...rawTransaction,
      //witnesses: [witness, ...rawTransaction.witnesses.slice(1)],
      witnesses: [...rawTransaction.witnesses.slice(0, 2), witness, ...rawTransaction.witnesses.slice(3)],
    }
    return [signedTx, txHash]
  }
}
