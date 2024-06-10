export type CleanUpFunction = () => Promise<any> | any

export class TestCleaner {
  private funcs = new Array<CleanUpFunction>()

  add = (...funcs: CleanUpFunction[]) => {
    funcs.forEach((cb) => {
      this.funcs.push(cb)
    })
  }

  cleanUp = async (onError: (err: unknown) => void | Promise<void>) => {
    // Clean up functions are called in reverse order like in Golang
    for (let i = this.funcs.length - 1; i >= 0; i--) {
      const func = this.funcs.at(i)
      if (func != null) {
        // If one or more of the cleanup functions fails, we do NOT want to
        // throw an error. Instead we continue running the other clean up
        // functions so that all resources are gracefully released
        try {
          await func()
        } catch (err) {
          try {
            onError(err)
          } catch (err) {
            console.error(err)
          }
        }
      }
    }

    // Once all the clean up functions have been called, reset the state
    this.funcs = []
  }
}
