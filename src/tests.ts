async function tests() {
  let a: Array<number> = [4]

  async function f(input: Array<number>): Promise<Array<number>> {
    console.log('called')
    return Promise.resolve(input)
  }

  //a = [1,2,3]
  a.push(7)
  console.log('' + (await f(a)))
}

tests()

export { tests }
