import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import type { Cell, Script } from '@ckb-lumos/base'
import { utils } from '@ckb-lumos/base'


export function scriptHash(script: Script) : string {
  return scriptToHash({
    args: script.args,
    codeHash: script.code_hash,
    hashType: script.hash_type
  })
}

export function scriptCamelToSnake(script: CKBComponents.Script) : Script{
  return {
    args: script.args,
    code_hash: script.codeHash,
    hash_type: script.hashType
  }
}

export function scriptSnakeToCamel(script: Script) : CKBComponents.Script{
  return {
    args: script.args,
    codeHash: script.code_hash,
    hashType: script.hash_type
  }
}

export const leHexToBigIntUint128 = (rawHexString : string) : bigint =>{
  return utils.readBigUInt128LE(prepare0xPrefix(rawHexString))
}

export const leHexToBigIntUint64 = (rawHexString : string) : bigint =>{
  return utils.readBigUInt64LE(prepare0xPrefix(rawHexString))
}

export const Uint128BigIntToLeHex = (u128: bigint) : string=> {
  return utils.toBigUInt128LE(u128)
}

export const Uint64BigIntToLeHex = (u64: bigint) : string=> {
  return utils.toBigUInt64LE(u64)
}

/*
convert little-endian hex string to big-endian hex string
and
vice-verse
 */
export const changeHexEncodeEndian = (leHex : string) : string =>{
  return `0x${Buffer.from(remove0xPrefix(leHex), 'hex').reverse().toString('hex')}`
}

/*export const scriptSize = (script: CKBComponents.Script) : bigint =>{
  const str = serializeScript(script).substring(2);
  return BigInt(str.length/2)
}*/

export const getCellFromRawTransaction = (rawTx:CKBComponents.RawTransaction, txHash:string ,index: number)
  : Cell =>{

  return {
    cell_output:{
      capacity: rawTx.outputs[index].capacity,
      lock : scriptCamelToSnake(rawTx.outputs[index].lock),
      type : rawTx.outputs[index].type?scriptCamelToSnake(rawTx.outputs[index].type!):undefined,
    },
    data: rawTx.outputsData[index],
    out_point:  {
      tx_hash:txHash,
      index :`0x${index.toString(16)}`
    }
  }
}

export function remove0xPrefix (input:string) : string{
  return input.startsWith('0x')?input.substring(2):input
}

export function prepare0xPrefix(input:string) : string{
  return input.startsWith('0x')? input: '0x'+input
}

