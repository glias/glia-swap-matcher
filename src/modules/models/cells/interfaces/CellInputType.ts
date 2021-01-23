// mark a cell could be a CellInput while Transformation
export interface CellInputType {
  toCellInput() : CKBComponents.CellInput
  getOutPoint():string
}
