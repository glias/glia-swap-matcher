import { injectable } from 'inversify'
import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import { CKB_NODE_URL } from '../../utils/envs'
import { DealStatus } from '../models/entities/deal.entity'
import { OutPoint } from '@ckb-lumos/base'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import JSONbig from 'json-bigint'
import { logger } from '../../utils/logger'
import { prepare0xPrefix, remove0xPrefix } from '../../utils/tools'
import { Script, WitnessArgs } from '../../utils/blockchain'
import { ETHSPVProof, MintTokenWitness } from '../../utils/witness'
import * as rlp from 'rlp'

const abiCoder = require('web3-eth-abi')

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

  // getTip = async (): Promise<string> => {
  //   return await this.#client.getTipBlockNumber()
  // }

  getTxsStatus = async (txHashes: Array<string>): Promise<Array<[string, Omit<DealStatus, DealStatus.Sent>]>> => {
    const requests: Array<['getTransaction', string]> = txHashes.map(hash => ['getTransaction', hash])

    let results: Array<CKBComponents.TransactionWithStatus> = await this.#client.createBatchRequest(requests).exec()

    this.#info(`rpc batch getTransaction result: ${JSONbig.stringify(results)}`)

    const ret: Array<[string, Omit<DealStatus, DealStatus.Sent>]> = txHashes.map((hash, index) => {
      const result = results[index]
      if (results[index] != null) {
        if (hash !== result.transaction.hash) {
          this.#error("that's impossible")
        }
        const txRes: Omit<DealStatus, DealStatus.Sent> =
          result.txStatus.status === 'committed' ? DealStatus.Committed : DealStatus.CutOff
        return [hash, txRes]
      }
      return [hash, DealStatus.CutOff]
    })

    return ret
  }

  // getTx = async (txHash: string): Promise<CKBComponents.TransactionWithStatus> => {
  //   return await this.#client.getTransaction(txHash)
  // }

  // give an outpoint of certain cell, find a lockscript fromCell the tx inside the
  // the outpoint which matches target hash
  getLockScript = async (outPoint: OutPoint, lockScriptHash: string): Promise<CKBComponents.Script | null> => {
    const tx = await this.#client.getTransaction(outPoint.tx_hash!)

    // try to find from inputs from the tx
    for (let input of tx.transaction.inputs) {
      const pre_tx = await this.#client.getTransaction(input.previousOutput!.txHash)
      const outputCell = pre_tx.transaction.outputs[Number(input.previousOutput!.index)]
      if (scriptToHash(outputCell.lock).toLowerCase() === lockScriptHash.toLowerCase()) {
        this.#info(`find script of tx ${lockScriptHash} from previous tx`)
        return outputCell.lock
      }
    }

    //try to find from witness[0] for force-eth-bridge
    try {
      const witness = tx.transaction.witnesses[0]
      const lock = this.parseWitness(witness)
      if (scriptToHash(lock).toLowerCase() === lockScriptHash.toLowerCase()) {
        this.#info(`find script of tx ${lockScriptHash} from witness`)
        return lock
      }
    } catch (e) {}
    this.#info(`script of tx ${lockScriptHash} is missing`)
    return null
  }

  parseWitness = (witness: CKBComponents.Witness): CKBComponents.Script => {
    const jsbuffer = Buffer.from(remove0xPrefix(witness), 'hex')
    //console.log(jsbuffer.length)

    const buffer: ArrayBuffer = this.toArrayBuffer(jsbuffer)
    //console.log(buffer.byteLength)

    const witnessArgs = new WitnessArgs(buffer)

    const witnessArgsLockRaw = witnessArgs.getLock().value().raw()

    //console.log('lock: ' + witnessArgsLockRaw)

    const mintTokenWitness = new MintTokenWitness(witnessArgsLockRaw)
    const spvProofRaw = mintTokenWitness.getSpvProof().raw()
    const ethSpvProof = new ETHSPVProof(spvProofRaw)

    const logEntryData = ethSpvProof.getLogEntryData().raw()
    /*
    pub struct LogEntry {
      /// address
      pub address: Address,
      /// topics
      pub topics: Vec<H256>,
      /// data
      pub data: Vec<u8>,
    }
     */
    // @ts-ignore
    const logEntry: Array<Buffer> = rlp.decode(toBuffer(logEntryData))
    //console.log(logEntry)

    /*
    pub struct ETHLockEvent {
      pub contract_address: [u8; 20],
      pub token: [u8; 20],
      pub sender: [u8; 20],
      pub locked_amount: U256,
      pub bridge_fee: U256,
      pub recipient_lockscript: Vec<u8>,
      pub replay_resist_outpoint: Vec<u8>,
      pub sudt_extra_data: Vec<u8>,
    }
    event Locked(
      address indexed token,
      address indexed sender,
      uint256 lockedAmount,
      uint256 bridgeFee,
      bytes recipientLockscript,
      bytes replayResistOutpoint,
      bytes sudtExtraData
    );
     */
    const dataBuffer: Buffer = logEntry[2]
    //console.log(dataBuffer.toString('hex'))

    let event = abiCoder.decodeLog(
      [
        {
          type: 'uint256',
          name: 'locked_amount',
        },
        {
          type: 'uint256',
          name: 'bridge_fee',
        },
        {
          type: 'bytes',
          name: 'recipient_lockscript',
        },
        {
          type: 'bytes',
          name: 'replay_resist_outpoint',
        },
        {
          type: 'bytes',
          name: 'sudt_extra_data',
        },
      ],
      prepare0xPrefix(dataBuffer.toString('hex')),
      [],
    )

    //console.log(event)

    let scriptEncodedHex: string = event.recipient_lockscript

    let script = new Script(this.toArrayBuffer(Buffer.from(remove0xPrefix(scriptEncodedHex), 'hex')))
    //console.log('script: '+script)

    let codeHash = script.getCodeHash().raw()
    let hashType = script.getHashType()
    let args = script.getArgs().raw()

    ///console.log('codeHash: '+this.toBuffer(codeHash).toString('hex'))
    ///console.log('hashType: '+hashType.toString(16))
    ///console.log('args: '+this.toBuffer(args).toString('hex'))

    return {
      args: prepare0xPrefix(this.toBuffer(args).toString('hex')),
      codeHash: prepare0xPrefix(this.toBuffer(codeHash).toString('hex')),
      hashType: hashType === 0 ? 'data' : 'type',
    }
  }

  sendTransaction = async (rawTx: CKBComponents.RawTransaction): Promise<void> => {
    try {
      //this.#info('sendTransaction : ' + JSONbig.stringify(rawTx, null, 2))
      await this.#client.sendTransaction(rawTx)
    } catch (e) {
      this.#error('sendTransaction error: ' + e)
    }
  }

  private toArrayBuffer = (buf: Buffer): ArrayBuffer => {
    let ab = new ArrayBuffer(buf.length)
    let view = new Uint8Array(ab)
    for (let i = 0; i < buf.length; ++i) {
      view[i] = buf[i]
    }
    return ab
  }

  private toBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
    let b = new Buffer(arrayBuffer.byteLength)
    let view = new Uint8Array(arrayBuffer)

    for (let i = 0; i < b.length; ++i) {
      b[i] = view[i]
    }
    return b
  }
}
