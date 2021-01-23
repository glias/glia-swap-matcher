import { Info } from '../cells/info'
import { Pool } from '../cells/pool'
import { MatcherChange } from '../cells/matcherChange'
import { SwapBuyTransformation } from '../transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../transformation/swapSellTransformation'
import { Match } from './interfaces/match'

export class SwapMatch implements Match{
  // contexts
  info : Info
  pool : Pool
  matcherChange : MatcherChange

  // transformations to process
  buyXforms :Array<SwapBuyTransformation>
  sellXforms : Array<SwapSellTransformation>

  // null if this Match doesn't need to send tx, which means, no match jobs are done
  composedTx?: CKBComponents.RawTransaction
  composedTxHash?: string
  skip:boolean

  constructor(info: Info, pool: Pool, matcherChange: MatcherChange, buyXforms: Array<SwapBuyTransformation>, sellXforms: Array<SwapSellTransformation>) {
    this.info = info
    this.pool = pool
    this.matcherChange = matcherChange
    this.buyXforms = buyXforms
    this.sellXforms = sellXforms
    this.skip = false

  }
}
