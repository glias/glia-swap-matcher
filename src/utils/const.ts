import 'dotenv/config'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import { HashType, QueryOptions } from '@ckb-lumos/base'
import { scriptCamelToSnake } from './tools'
import { privateKeyToPublicKey, blake160 } from '@nervosnetwork/ckb-sdk-utils'

export const NODE_ENV :string = process.env.NODE_ENV ? process.env.NODE_ENV :'production'
export const DEFAULT_NODE_URL = process.env.NODE_URL!
export const DEFAULT_FEE_PRICE = '1000'
export const INDEXER_DB_PATH = 'indexer-data'
export const BLOCK_MINER_FEE = 100000n
export const PRIVATE_KEY = process.env.PRIVATE_KEY!

// sudtChangeAmount
export const SUDT_TYPE_TX_HASH = process.env.SUDT_TX_HASH!
export const SUDT_TYPE_CODE_HASH = process.env.SUDT_CODE_HASH!
export const SUDT_TYPE_HASH_TYPE : HashType  = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'
export const SUDT_TYPE_ARGS = process.env.SUDT_ARG!
export const SUDT_TYPE_SCRIPT  :CKBComponents.Script= {
  codeHash: SUDT_TYPE_CODE_HASH,
  hashType: SUDT_TYPE_HASH_TYPE,
  args: SUDT_TYPE_ARGS,
}
export const SUDT_TYPE_SCRIPT_HASH = scriptToHash(SUDT_TYPE_SCRIPT)

// lpt script
export const LPT_TX_HASH = process.env.SUDT_TX_HASH!
export const LPT_TYPE_CODE_HASH = process.env.SUDT_CODE_HASH!
export const LPT_TYPE_HASH_TYPE : HashType  = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'
export const LPT_TYPE_ARGS = process.env.SUDT_ARG!
export const LPT_TYPE_SCRIPT  :CKBComponents.Script= {
  codeHash: LPT_TYPE_CODE_HASH,
  hashType: LPT_TYPE_HASH_TYPE,
  args: LPT_TYPE_ARGS,
}
export const LPT_TYPE_SCRIPT_HASH = scriptToHash(LPT_TYPE_SCRIPT)

// info cell type script and lock script
export const INFO_TYPE_SCRIPT_TX_HASH = process.env.INFO_TYPE_SCRIPT_TX_HASH!
export const INFO_TYPE_CODE_HASH = process.env.INFO_TYPE_SCRIPT_TX_HASH!
export const INFO_TYPE_HASH_TYPE : HashType  = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'
export const INFO_TYPE_ARGS = process.env.INFO_TYPE_SCRIPT_TX_HASH!
export const INFO_TYPE_SCRIPT :CKBComponents.Script= {
  codeHash: INFO_TYPE_CODE_HASH,
  hashType: INFO_TYPE_HASH_TYPE,
  args: INFO_TYPE_ARGS,
}
export const INFO_TYPE_SCRIPT_HASH = scriptToHash(INFO_TYPE_SCRIPT)

export const INFO_LOCK_SCRIPT_TX_HASH = process.env.INFO_TYPE_SCRIPT_TX_HASH!
export const INFO_LOCK_CODE_HASH = process.env.INFO_TYPE_SCRIPT_TX_HASH!
export const INFO_LOCK_HASH_TYPE : HashType  = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'
export const INFO_LOCK_ARGS = process.env.INFO_TYPE_SCRIPT_TX_HASH!
export const INFO_LOCK_SCRIPT  :CKBComponents.Script= {
  codeHash: INFO_LOCK_CODE_HASH,
  hashType: INFO_LOCK_HASH_TYPE,
  args: INFO_LOCK_ARGS,
}


// pool, type: the sudtChangeAmount is as same as SUDT_XXX
export const POOL_TYPE_SCRIPT_TX_HASH = SUDT_TYPE_TX_HASH
export const POOL_TYPE_CODE_HASH = SUDT_TYPE_CODE_HASH
export const POOL_TYPE_HASH_TYPE = SUDT_TYPE_HASH_TYPE
export const POOL_TYPE_ARGS = SUDT_TYPE_ARGS
export const POOL_TYPE_SCRIPT = SUDT_TYPE_SCRIPT
export const POOL_TYPE_SCRIPT_HASH = SUDT_TYPE_SCRIPT_HASH


// pool, lock: the lock is as same as that of info
export const POOL_LOCK_SCRIPT_TX_HASH = INFO_LOCK_SCRIPT_TX_HASH
export const POOL_LOCK_CODE_HASH = INFO_LOCK_CODE_HASH
export const POOL_LOCK_HASH_TYPE = INFO_LOCK_HASH_TYPE
export const POOL_LOCK_ARGS = INFO_LOCK_ARGS
export const POOL_LOCK_SCRIPT = INFO_LOCK_SCRIPT

// liquidity req
export const LIQUIDITY_ADD_REQ_TYPE_SCRIPT = SUDT_TYPE_SCRIPT
export const LIQUIDITY_ADD_REQ_TYPE_SCRIPT_HASH = SUDT_TYPE_SCRIPT_HASH

export const LIQUIDITY_REMOVE_REQ_TYPE_SCRIPT = LPT_TYPE_SCRIPT
export const LIQUIDITY_REMOVE_REQ_TYPE_SCRIPT_HASH = LPT_TYPE_SCRIPT_HASH

export const LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH = process.env.LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH!
export const LIQUIDITY_REQ_LOCK_CODE_HASH = process.env.LIQUIDITY_REQ_LOCKSCRIPT_CODE_HASH!
export const LIQUIDITY_REQ_LOCK_HASH_TYPE : HashType = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'
export const LIQUIDITY_REQ_LOCK_ARGS_INFO_TYPE_SCRIPT_HASH = INFO_TYPE_SCRIPT_HASH

// swap
export const SWAP_REQ_TYPE_SCRIPT = SUDT_TYPE_SCRIPT
export const SWAP_REQ_TYPE_SCRIPT_HASH = SUDT_TYPE_SCRIPT_HASH

export const SWAP_REQ_LOCK_SCRIPT_TX_HASH = process.env.LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH!
export const SWAP_REQ_LOCK_CODE_HASH = process.env.LIQUIDITY_REQ_LOCKSCRIPT_CODE_HASH!
export const SWAP_REQ_LOCK_HASH_TYPE : HashType  = process.env.SUDT_CODE_HASH === 'type'? 'type':'data'


// secp256k1
export const SECP256K1_TX_HASH = '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37'
export const SECP256K1_CODE_HASH = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'
export const SECP256K1_HASH_TYPE = 'type'

// matcher change
export const MATCHER_PRIVATE_KEY = process.env.MATCHER_PRIVATE_KEY!
export const MATCHER_PUBLIC_KEY_HASH = `0x${blake160(privateKeyToPublicKey(MATCHER_PRIVATE_KEY), 'hex')}`

export const MATCHER_LOCK_SCRIPT :CKBComponents.Script ={
  codeHash: SECP256K1_CODE_HASH,
  hashType: SECP256K1_HASH_TYPE,
  args: MATCHER_PUBLIC_KEY_HASH,
}

export const MATCHER_SUDT_TYPE_SCRIPT :CKBComponents.Script = SUDT_TYPE_SCRIPT

export const MATCHER_LPT_TYPE_SCRIPT : CKBComponents.Script = LPT_TYPE_SCRIPT


export const SWAP_FEE_NOMINATOR = BigInt(3)
export const SWAP_FEE_DOMINATOR = BigInt(100)

export const LIQUIDITY_INFLATION_DOMINATOR = BigInt(100)


export const SWAP_REQ_QUERY_OPTION : QueryOptions = {
  type: {
    script: scriptCamelToSnake(SWAP_REQ_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: {
      code_hash: SWAP_REQ_LOCK_CODE_HASH,
      hash_type: SWAP_REQ_LOCK_HASH_TYPE,
      args: '0x',
    },
    argsLen: 'any',
  },
}

export const LIQUIDITY_ADD_REQ_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(LIQUIDITY_ADD_REQ_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: {
      code_hash: LIQUIDITY_REQ_LOCK_CODE_HASH,
      hash_type: LIQUIDITY_REQ_LOCK_HASH_TYPE,
      args: '0x'
    },
    argsLen: 'any',
  },
}

export const LIQUIDITY_REMOVE_REQ_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(LIQUIDITY_REMOVE_REQ_TYPE_SCRIPT),
    argsLen: 'any',
  },
  lock: {
    script: {
      code_hash: LIQUIDITY_REQ_LOCK_CODE_HASH,
      hash_type: LIQUIDITY_REQ_LOCK_HASH_TYPE,
      args: '0x'
    },
    argsLen: 'any',
  },
}

export const INFO_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(INFO_TYPE_SCRIPT),
    argsLen: INFO_TYPE_SCRIPT.args.length,
  },
  lock: {
    script: scriptCamelToSnake(INFO_LOCK_SCRIPT),
    argsLen: INFO_LOCK_SCRIPT.args.length,
  },
}

export const POOL_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(POOL_TYPE_SCRIPT),
    argsLen: POOL_TYPE_SCRIPT.args.length,
  },
  lock: {
    script: scriptCamelToSnake(POOL_LOCK_SCRIPT),
    argsLen: POOL_LOCK_SCRIPT.args.length,
  },
}

export const MATCHER_LPT_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(MATCHER_LPT_TYPE_SCRIPT),
    argsLen: MATCHER_LPT_TYPE_SCRIPT.args.length,
  },
  lock: {
    script: scriptCamelToSnake(MATCHER_LOCK_SCRIPT),
    argsLen: MATCHER_LOCK_SCRIPT.args.length,
  },
}
export const MATCHER_SUDT_QUERY_OPTION  : QueryOptions = {
  type: {
    script: scriptCamelToSnake(MATCHER_SUDT_TYPE_SCRIPT),
    argsLen: MATCHER_SUDT_TYPE_SCRIPT.args.length,
  },
  lock: {
    script: scriptCamelToSnake(MATCHER_LOCK_SCRIPT),
    argsLen: MATCHER_LOCK_SCRIPT.args.length,
  },
}

export const ALL_CELL_DEPS = [
  {
    outPoint: {
      txHash: SUDT_TYPE_SCRIPT_HASH,
      index: '0x0',
    },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: {
      txHash: INFO_TYPE_SCRIPT_TX_HASH,
      index: '0x0',
    },
    depType: 'code' as CKBComponents.DepType,
  }, {
    outPoint: {
      txHash: INFO_LOCK_SCRIPT_TX_HASH,
      index: '0x0',
    },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: {
      txHash: INFO_TYPE_SCRIPT_TX_HASH,
      index: '0x0',
    },
    depType: 'code' as CKBComponents.DepType,
  }, {
    outPoint: {
      txHash: INFO_LOCK_SCRIPT_TX_HASH,
      index: '0x0',
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
