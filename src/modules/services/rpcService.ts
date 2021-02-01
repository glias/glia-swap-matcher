import { injectable } from 'inversify'
import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import { CKB_NODE_URL } from '../../utils/envs'
import { DealStatus } from '../models/entities/deal.entity'
import { OutPoint } from '@ckb-lumos/base'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import JSONbig from 'json-bigint'
import { logger } from '../../utils/logger'

@injectable()
export default class RpcService {
  #client: Rpc

  #info = (msg: string) => {
    logger.info(`RpcService: ${msg}`)
  }
  #error = (msg: string) => {
    logger.error(`RpcService: ${msg}`)
  }

  constructor() {
    this.#client = new Rpc(CKB_NODE_URL)
  }

  getTip = async (): Promise<string> => {
    return await this.#client.getTipBlockNumber()
  }

  getTxsStatus = async (txHashes: Array<string>): Promise<Array<[string, Omit<DealStatus, DealStatus.Sent>]>> => {
    const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])

    let results: Array<CKBComponents.TransactionWithStatus> = await this.#client.createBatchRequest(requests).exec()

    this.#info(`rpc batch getTransaction result: ${JSONbig.stringify(results)}`)

    const ret : Array<[string, Omit<DealStatus, DealStatus.Sent>]>= txHashes.map((hash,index) =>{
      const result = results[index]
      if(results[index] !=null ){
        if(hash !== result.transaction.hash){
          this.#error('that\'s impossible')
        }
        const txRes :Omit<DealStatus, DealStatus.Sent>= result.txStatus.status === 'committed'? DealStatus.Committed: DealStatus.CutOff
        return [hash,txRes]
      }
      return [hash, DealStatus.CutOff]
    })

    return ret
  }

  getTx = async (txHash: string): Promise<CKBComponents.TransactionWithStatus> => {
    return await this.#client.getTransaction(txHash)
  }

  // give an outpoint of certain cell, find a lockscript fromCell the tx inside the
  // the outpoint which matches target hash
  getLockScript = async (outPoint: OutPoint, lockScriptHash: string): Promise<CKBComponents.Script | null> => {
    const tx = await this.#client.getTransaction(outPoint.tx_hash!)
    for (let input of tx.transaction.inputs) {
      const pre_tx = await this.#client.getTransaction(input.previousOutput!.txHash)
      const outputCell = pre_tx.transaction.outputs[Number(input.previousOutput!.index)]
      if (scriptToHash(outputCell.lock).toLowerCase() === lockScriptHash.toLowerCase()) {
        return outputCell.lock
      }
    }
    return null
  }

  sendTransaction = async (rawTx: CKBComponents.RawTransaction): Promise<void> => {
    try {
      this.#info(JSONbig.stringify(rawTx, null, 2))
      await this.#client.sendTransaction(rawTx)
    } catch (e) {
      this.#error('sendTransaction error: ' + e)
    }
  }
}
