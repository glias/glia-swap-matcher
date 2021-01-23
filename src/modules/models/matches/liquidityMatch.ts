import { Info } from '../cells/info'
import { Pool } from '../cells/pool'
import { MatcherChange } from '../cells/matcherChange'
import { LiquidityAddTransformation } from '../transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../transformation/liquidityRemoveTransformation'
import { Match } from './interfaces/match'

export class LiquidityMatch implements Match{
  // contexts
  info : Info
  pool : Pool
  matcherChange : MatcherChange

  // transformations to process
  addXforms :Array<LiquidityAddTransformation>
  removeXforms : Array<LiquidityRemoveTransformation>

  // null if this Match doesn't need to send tx, which means, no match jobs are done
  composedTx?: CKBComponents.RawTransaction
  composedTxHash?: string
  skip:boolean

  constructor(info: Info, pool: Pool, matcherChange: MatcherChange, addXforms: Array<LiquidityAddTransformation>, removeXforms: Array<LiquidityRemoveTransformation>) {
    this.info = info
    this.pool = pool
    this.matcherChange = matcherChange
    this.addXforms = addXforms
    this.removeXforms = removeXforms
    this.skip = false
  }
}
