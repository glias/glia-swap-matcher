import type { Cell } from '@ckb-lumos/base'
import { SwapBuyReq } from '../cells/swapBuyReq'
import { Sudt } from '../cells/sudt'
import { Transformation } from './interfaces/transformation'

export class SwapBuyTransformation implements Transformation {
  public static SUDT_FIXED_CAPACITY = Sudt.SUDT_FIXED_CAPACITY

  // capacity should be SUDT's capacity
  sudtAmount: bigint

  request: SwapBuyReq
  processed: boolean
  skip: boolean

  outputSudt?: Sudt

  constructor(request: SwapBuyReq) {
    this.sudtAmount = 0n
    this.request = request
    this.processed = false
    this.skip = false
  }

  static validate(_cell: Cell) {
    return true
  }

  process(): void {
    if (!this.processed) {
      this.outputSudt = Sudt.from(this.sudtAmount, this.request.originalUserLock)
    }
  }

  toCellInput(): CKBComponents.CellInput {
    return this.request.toCellInput()
  }

  toCellOutput(): Array<CKBComponents.CellOutput> {
    this.process()

    return [this.outputSudt!.toCellOutput()]
  }

  toCellOutputData(): Array<string> {
    this.process()

    return [this.outputSudt!.toCellOutputData()]
  }
}
