import { injectable } from 'inversify'
import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import { CKB_NODE_URL } from '../../utils/envs'
import { DealStatus } from '../models/entities/deal.entity'
import { OutPoint } from '@ckb-lumos/base'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'

@injectable()
export default class RpcService {
  #client: Rpc

  constructor() {
    this.#client = new Rpc(CKB_NODE_URL)
  }

  getTip = async (): Promise<string> => {
    return await this.#client.getTipBlockNumber()
  }

  getTxsStatus = async (txHashes: Array<string>): Promise<Array<[string, Omit<DealStatus, DealStatus.Sent>]>> => {
    const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])

    const results: Array<CKBComponents.TransactionWithStatus> = await this.#client.createBatchRequest(requests).exec()
    console.log(JSON.stringify(results))
    return results.map(result => {
      console.log(`rpc batch getTransaction result: ${JSON.stringify(result)}`)
      return result.txStatus.status === 'committed'
        ? [result.transaction.hash, DealStatus.Committed]
        : [result.transaction.hash, DealStatus.CutOff]
    })
  }

  // give an outpoint of certain cell, find a lockscript fromCell the tx inside the
  // the outpoint which matches target hash
  getLockScript = async (outPoint: OutPoint, lockScriptHash: string): Promise<CKBComponents.Script | null> => {
    const tx = await this.#client.getTransaction(outPoint.tx_hash!)
    for (let input of tx.transaction.inputs) {
      const pre_tx = await this.#client.getTransaction(input.previousOutput!.txHash)
      const outputCell = pre_tx.transaction.outputs[Number(input.previousOutput!.index)]
      if (scriptToHash(outputCell.lock) === lockScriptHash) {
        return outputCell.lock
      }
    }
    return null
  }

  sendTransaction = async (rawTx: CKBComponents.RawTransaction): Promise<void> => {
    await this.#client.sendTransaction(rawTx)
  }
}
