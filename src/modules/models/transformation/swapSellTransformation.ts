import type { Cell } from '@ckb-lumos/base'
import { Ckb } from '../cells/ckb'
import { SwapSellReq } from '../cells/swapSellReq'
import { Transformation } from './interfaces/transformation'

export class SwapSellTransformation implements Transformation {
  public static CKB_FIXED_MIN_CAPACITY = Ckb.CKB_FIXED_MIN_CAPACITY

  // all ckbs it gets
  capacity: bigint

  request: SwapSellReq
  processed: boolean
  skip: boolean
  outputCkb?: Ckb

  constructor(request: SwapSellReq) {
    this.capacity = 0n
    this.request = request

    this.processed = false
    this.skip = false
  }

  static validate(_cell: Cell) {
    return true
  }

  process(): void {
    if (!this.processed) {
      this.outputCkb = Ckb.from(this.capacity, this.request.originalUserLock)
    }
  }

  toCellInput(): CKBComponents.CellInput {
    return this.request.toCellInput()
  }

  toCellOutput(): Array<CKBComponents.CellOutput> {
    this.process()

    return [this.outputCkb!.toCellOutput()]
  }

  toCellOutputData(): Array<string> {
    this.process()

    return [this.outputCkb!.toCellOutputData()]
  }
}
