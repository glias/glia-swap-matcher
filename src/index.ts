import 'reflect-metadata'
import boostrap from './bootstrap'
import { container, modules } from './container'
import { logger } from './utils/logger'
import TaskService from './modules/services/taskService'
import { NODE_ENV } from './utils/envs'

const logTag = `\x1b[35m[Glia Swap Matcher]\x1b[0m`
export default class GliaSwapMatcher {
  #ready = false

  #log = (msg: string) => {
    logger.info(`${logTag}: ${msg}`)
  }

  private static get taskService() {
    return container.get<TaskService>(modules[TaskService.name])
  }

  #bootstrap = async () => {
    if (!this.#ready) {
      try {
        await boostrap()
        this.#ready = true
      } catch (err) {
        logger.error(err)
      }
    }
  }

  public run = async () => {
    // TODO: use decorator to handle bootstrap

    this.#log('Glia-Swap-Matcher is running under: ' + NODE_ENV)

    await this.#bootstrap()
    await GliaSwapMatcher.taskService.start()
    this.#log('started')
  }
}

new GliaSwapMatcher().run()
