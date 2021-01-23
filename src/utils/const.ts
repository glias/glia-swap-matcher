import 'dotenv/config'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import { HashType, QueryOptions } from '@ckb-lumos/base'
import { remove0xPrefix, scriptCamelToSnake } from './tools'
import { privateKeyToPublicKey, blake160 } from '@nervosnetwork/ckb-sdk-utils'

export const NODE_ENV :string = process.env.NODE_ENV ?process.env.NODE_ENV:'production'
export const DEFAULT_NODE_URL = process.env.NODE_URL!
export const DEFAULT_FEE_PRICE = '1000'
export const INDEXER_DB_PATH = 'indexer-data'
export const BLOCK_MINER_FEE = process.env.BLOCK_MINER_FEE ? BigInt(process.env.BLOCK_MINER_FEE):100000n
export const PRIVATE_KEY = process.env.PRIVATE_KEY!

// sudt
/*
capacity: - 8 bytes
data: amount: u128 - 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock
 */
export const SUDT_TYPE_OUTPOINT_TX_HASH = process.env.SUDT_TYPE_OUTPOINT_TX_HASH!
export const SUDT_TYPE_OUTPOINT_INDEX = process.env.SUDT_TYPE_OUTPOINT_INDEX!

export const SUDT_TYPE_CODE_HASH = process.env.SUDT_TYPE_CODE_HASH!
export const SUDT_TYPE_HASH_TYPE : HashType  = process.env.SUDT_TYPE_HASH_TYPE === 'type'? 'type':'data'
export const SUDT_TYPE_ARGS = process.env.SUDT_TYPE_ARGS!
export const SUDT_TYPE_SCRIPT  :CKBComponents.Script= {
  codeHash: SUDT_TYPE_CODE_HASH,
  hashType: SUDT_TYPE_HASH_TYPE,
  args: SUDT_TYPE_ARGS,
}
export const SUDT_TYPE_SCRIPT_HASH = scriptToHash(SUDT_TYPE_SCRIPT)

// lpt script
/*
capacity: - 8 bytes
data: amount: u128 - 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock
 */
export const LPT_TYPE_OUTPOINT_TX_HASH = process.env.LPT_TYPE_OUTPOINT_TX_HASH!
export const LPT_TYPE_OUTPOINT_INDEX = process.env.LPTT_TYPE_OUTPOINT_INDEX!

export const LPT_TYPE_CODE_HASH = process.env.LPT_TYPE_CODE_HASH!
export const LPT_TYPE_HASH_TYPE : HashType  = process.env.LPT_TYPE_HASH_TYPE === 'type'? 'type':'data'
export const LPT_TYPE_ARGS = process.env.LPT_TYPE_ARGS!
export const LPT_TYPE_SCRIPT  :CKBComponents.Script= {
  codeHash: LPT_TYPE_CODE_HASH,
  hashType: LPT_TYPE_HASH_TYPE,
  args: LPT_TYPE_ARGS,
}
export const LPT_TYPE_SCRIPT_HASH = scriptToHash(LPT_TYPE_SCRIPT)


// info cell type script and lock script
/*
define INFO_TYPE_CODE_HASH
define INFO_LOCK_CODE_HASH
define INFO_CAPACITY = 250 * 10^8

capacity: - 8 bytes
data: - 80 bytes
    ckb_reserve: u128 16 bytes
    sudt_reserve: u128
    total_liquidity: u128
    liquidity_sudt_type_hash: 32 bytes
type: - 65 bytes
    code: INFO_TYPE_CODE_HASH - 32 bytes + 1 byte
    args: id - 32 bytes
lock: - 97 bytes
    code: INFO_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: hash(ckb | asset_sudt_type_hash) 32 bytes | info_type_hash - 32 bytes
 */
export const INFO_TYPE_OUTPOINT_TX_HASH = process.env.INFO_TYPE_OUTPOINT_TX_HASH!
export const INFO_TYPE_OUTPOINT_INDEX = process.env.INFO_TYPE_OUTPOINT_INDEX!

export const INFO_TYPE_CODE_HASH = process.env.INFO_TYPE_CODE_HASH!
export const INFO_TYPE_HASH_TYPE : HashType  = process.env.INFO_TYPE_HASH_TYPE === 'type'? 'type':'data'
export const INFO_TYPE_ARGS = process.env.INFO_TYPE_ARGS! // should be 32 bytes
export const INFO_TYPE_SCRIPT :CKBComponents.Script= {
  codeHash: INFO_TYPE_CODE_HASH,
  hashType: INFO_TYPE_HASH_TYPE,
  args: INFO_TYPE_ARGS,
}
export const INFO_TYPE_SCRIPT_HASH = scriptToHash(INFO_TYPE_SCRIPT)

//==========
export const INFO_LOCK_OUTPOINT_TX_HASH = process.env.INFO_LOCK_OUTPOINT_TX_HASH!
export const INFO_LOCK_OUTPOINT_INDEX = process.env.INFO_LOCK_OUTPOINT_INDEX!

export const INFO_LOCK_CODE_HASH = process.env.INFO_LOCK_CODE_HASH!
export const INFO_LOCK_HASH_TYPE : HashType  = process.env.INFO_LOCK_HASH_TYPE === 'type'? 'type':'data'
export const INFO_LOCK_ARGS = process.env.INFO_LOCK_ARGS! // should be 64 bytes
export const INFO_LOCK_SCRIPT  :CKBComponents.Script= {
  codeHash: INFO_LOCK_CODE_HASH,
  hashType: INFO_LOCK_HASH_TYPE,
  args: INFO_LOCK_ARGS,
}
export const INFO_LOCK_SCRIPT_HASH = scriptToHash(INFO_LOCK_SCRIPT)


export const INFO_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(INFO_TYPE_SCRIPT),
    argsLen: calcArgLength(INFO_TYPE_ARGS),//for id
  },
  lock: {
    script: scriptCamelToSnake(INFO_LOCK_SCRIPT),
    argsLen: calcArgLength(INFO_LOCK_ARGS),
  },
}


// pool
/*
define POOL_BASE_CAPACITY =  186 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount
type: sudt_type - 65 bytes
lock: info_lock - 97 bytes
 */
export const POOL_TYPE_OUTPOINT_TX_HASH = SUDT_TYPE_OUTPOINT_TX_HASH!
export const POOL_TYPE_OUTPOINT_INDEX = SUDT_TYPE_OUTPOINT_INDEX!

export const POOL_TYPE_CODE_HASH = SUDT_TYPE_CODE_HASH
export const POOL_TYPE_HASH_TYPE = SUDT_TYPE_HASH_TYPE
export const POOL_TYPE_ARGS = SUDT_TYPE_ARGS
export const POOL_TYPE_SCRIPT = SUDT_TYPE_SCRIPT
export const POOL_TYPE_SCRIPT_HASH = SUDT_TYPE_SCRIPT_HASH


// pool, lock: the lock is as same as that of info
export const POOL_LOCK_OUTPOINT_TX_HASH = INFO_LOCK_OUTPOINT_TX_HASH!
export const POOL_LOCK_OUTPOINT_INDEX = INFO_LOCK_OUTPOINT_INDEX!

export const POOL_LOCK_CODE_HASH = INFO_LOCK_CODE_HASH!
export const POOL_LOCK_HASH_TYPE = INFO_LOCK_HASH_TYPE!
export const POOL_LOCK_SCRIPT = INFO_LOCK_SCRIPT!


export const POOL_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(POOL_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: scriptCamelToSnake(POOL_LOCK_SCRIPT),
    argsLen: 'any',
  },
}


// liquidity

export const LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH = process.env.LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH!
export const LIQUIDITY_REQ_LOCK_CODE_HASH = process.env.LIQUIDITY_REQ_LOCKSCRIPT_CODE_HASH!
export const LIQUIDITY_REQ_LOCK_HASH_TYPE : HashType = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'

export const LIQUIDITY_REQ_LOCK_SCRIPT  :CKBComponents.Script= {
  codeHash: LIQUIDITY_REQ_LOCK_CODE_HASH,
  hashType: LIQUIDITY_REQ_LOCK_HASH_TYPE,
  args: '0x'
}

// add req
/*
define LIQUIDITY_REQ_LOCK_CODE_HASH
define LIQUIDITY_REQ_CAPACITY = 235 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: asset_sudt_type for add - 65 bytes
lock: - 146 bytes
    code: LIQUIDITY_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32)
    | version (u8, 1 byte, 32..33)
    | sudtMin (u128, 16 bytes, 33..49)
    | ckbMin (u64, 8 bytes, 49..57)
    | info_type_hash_32 (32 bytes, 57..89)
    | tips (8 bytes, 89..97)
    | tips_sudt (16 bytes, 97..113)
 */
export const LIQUIDITY_ADD_REQ_TYPE_SCRIPT = SUDT_TYPE_SCRIPT
export const LIQUIDITY_ADD_REQ_TYPE_SCRIPT_HASH = SUDT_TYPE_SCRIPT_HASH


export const LIQUIDITY_ADD_REQ_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(LIQUIDITY_ADD_REQ_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: scriptCamelToSnake(LIQUIDITY_REQ_LOCK_SCRIPT),
    argsLen: 'any',
  },
}


// liquidity remove req
/*
define LIQUIDITY_REQ_LOCK_CODE_HASH
define LIQUIDITY_REQ_CAPACITY = 235 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: liquidity_sudt_type for remove - 65 bytes
lock: - 146 bytes
    code: LIQUIDITY_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32)
    | version (u8, 1 byte, 32..33)
    | sudtMin (u128, 16 bytes, 33..49)
    | ckbMin (u64, 8 bytes, 49..57)
    | info_type_hash_32 (32 bytes, 57..89)
    | tips (8 bytes, 89..97)
    | tips_sudt (16 bytes, 97..113)
 */
export const LIQUIDITY_REMOVE_REQ_TYPE_SCRIPT = LPT_TYPE_SCRIPT
export const LIQUIDITY_REMOVE_REQ_TYPE_SCRIPT_HASH = LPT_TYPE_SCRIPT_HASH

export const LIQUIDITY_REMOVE_REQ_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(LIQUIDITY_REMOVE_REQ_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: scriptCamelToSnake(LIQUIDITY_REQ_LOCK_SCRIPT),
    argsLen: 'any',
  },
}

// swap


export const SWAP_REQ_LOCK_SCRIPT_TX_HASH = process.env.SWAP_REQ_LOCK_SCRIPT_TX_HASH!
export const SWAP_REQ_LOCK_SCRIPT_INDEX = process.env.SWAP_REQ_LOCK_SCRIPT_INDEX!

export const SWAP_REQ_LOCK_CODE_HASH = process.env.LIQUIDITY_REQ_LOCKSCRIPT_CODE_HASH!
export const SWAP_REQ_LOCK_HASH_TYPE : HashType  = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'

export const  SWAP_REQ_LOCK_SCRIPT  :CKBComponents.Script= {
  codeHash: SWAP_REQ_LOCK_CODE_HASH,
  hashType: SWAP_REQ_LOCK_HASH_TYPE,
  args: '0x',
}

// buy
/*
define SWAP_REQ_LOCK_CODE_HASH
define SWAP_REQ_CAPACITY_SELL = 227 * 10^8
define SWAP_REQ_CAPACITY_BUY = 146 * 10^8

enum swap_request_type {
    sell
    buy
}

capacity: - 8 bytes
data: -  null for buy
type: null for buy - 0 bytes
lock: - 138 bytes
    code: SWAP_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32)
    | version (u8, 1 byte, 32..33)
    | amountOutMin (u128, 16 bytes, 33..49)
    | sudt_type_hash (32 bytes, 49..81)
    | tips (8 bytes, 81..89)
    | tips_sudt (16 bytes, 89..105)
 */
export const SWAP_BUY_REQ_TYPE_SCRIPT = null
export const SWAP_BUY_REQ_TYPE_SCRIPT_HASH = null


export const SWAP_BUY_REQ_QUERY_OPTION : QueryOptions = {
  type: 'empty',
  lock: {
    script: scriptCamelToSnake(SWAP_REQ_LOCK_SCRIPT),
    argsLen: 'any',
  },
}

// sell
/*
define SWAP_REQ_LOCK_CODE_HASH
define SWAP_REQ_CAPACITY_SELL = 227 * 10^8
define SWAP_REQ_CAPACITY_BUY = 146 * 10^8

enum swap_request_type {
    sell
    buy
}

capacity: - 8 bytes
data: - 16 bytes for sell
    sudt_amount: u128
type: sudt_type for sell - 65 bytes
lock: - 138 bytes
    code: SWAP_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: user_lock_hash (32 bytes, 0..32)
    | version (u8, 1 byte, 32..33)
    | amountOutMin (u128, 16 bytes, 33..49)
    | sudt_type_hash (32 bytes, 49..81)
    | tips (8 bytes, 81..89)
    | tips_sudt (16 bytes, 89..105)
 */
export const SWAP_SELL_REQ_TYPE_SCRIPT = SUDT_TYPE_SCRIPT
export const SWAP_SELL_REQ_TYPE_SCRIPT_HASH = SUDT_TYPE_SCRIPT_HASH


export const SWAP_SELL_REQ_QUERY_OPTION : QueryOptions = {
  type: {
    script: scriptCamelToSnake(SWAP_SELL_REQ_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: scriptCamelToSnake(SWAP_REQ_LOCK_SCRIPT),
    argsLen: 'any',
  },
}


// secp256k1
export const SECP256K1_TX_HASH = '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37'
export const SECP256K1_CODE_HASH = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'
export const SECP256K1_HASH_TYPE = 'type'

// matcher change, ckb
export const MATCHER_PRIVATE_KEY = process.env.MATCHER_PRIVATE_KEY!
export const MATCHER_PUBLIC_KEY_HASH = `0x${blake160(privateKeyToPublicKey(MATCHER_PRIVATE_KEY), 'hex')}`

export const MATCHER_LOCK_SCRIPT :CKBComponents.Script ={
  codeHash: SECP256K1_CODE_HASH,
  hashType: SECP256K1_HASH_TYPE,
  args: MATCHER_PUBLIC_KEY_HASH,
}

export const MATCHER_QUERY_OPTION : QueryOptions = {
  type: 'empty',
  lock: {
    script: scriptCamelToSnake(MATCHER_LOCK_SCRIPT),
    argsLen: 20,
  },
}


export const ALL_CELL_DEPS = [
  {
    outPoint: {
      txHash: SUDT_TYPE_OUTPOINT_TX_HASH,
      index: SUDT_TYPE_OUTPOINT_INDEX,
    },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: {
      txHash: INFO_TYPE_OUTPOINT_TX_HASH,
      index: INFO_TYPE_OUTPOINT_INDEX,
    },
    depType: 'code' as CKBComponents.DepType,
  }, {
    outPoint: {
      txHash: INFO_LOCK_OUTPOINT_TX_HASH,
      index: INFO_LOCK_OUTPOINT_INDEX,
    },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: {
      txHash: POOL_LOCK_OUTPOINT_TX_HASH,
      index: POOL_LOCK_OUTPOINT_INDEX,
    },
    depType: 'code' as CKBComponents.DepType,
  }, {
    outPoint: {
      txHash: POOL_TYPE_OUTPOINT_TX_HASH,
      index: POOL_TYPE_OUTPOINT_INDEX,
    },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: {
      txHash: SECP256K1_TX_HASH,
      index: '0x0',
    },
    depType: 'depGroup' as CKBComponents.DepType,
  },
]


function calcArgLength(args: string) :number {
  return remove0xPrefix(args).length/2
}
