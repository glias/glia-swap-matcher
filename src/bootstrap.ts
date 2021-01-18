import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { createConnection } from 'typeorm'
import { container, modules } from './container'
import { logger, NODE_ENV } from './utils'


const logTag = `\x1b[35m[Bootstrap]\x1b[0m`

const registerModule = async (modulePath: string) => {
  logger.info(`registerModule: ${modulePath}`)
  const { default: m } = await import(modulePath)
  modules[m.name] = Symbol(m.name)
  container.bind(modules[m.name]).to(m)
  logger.debug(`${logTag}: \x1b[36m${m.name}\x1b[0m is loaded`)
}

const connectDatabase = async () => {

  const connection = await createConnection(NODE_ENV)
  logger.debug(`${logTag}: Connected to database \x1b[36m${connection.name}\x1b[0m`)
  return connection
}

// register all ts files under modules with @injectable()
const bootstrap = async () => {
  const modulesDir = path.join(__dirname, 'modules')
  const repositoriesDir = path.join(modulesDir, 'repositories')
  const servicesDir = path.join(modulesDir, 'services')

  for(let injectableDir of [repositoriesDir,servicesDir]){
    const injectablePaths = await promisify(fs.readdir)(injectableDir, 'utf8').then(injectableNames =>
      injectableNames.map(injectableName => path.join(injectableDir, injectableName)),
    )
    for (const injectablePath of injectablePaths) {
      await registerModule(injectablePath)
    }
  }



  await connectDatabase()
}

export default bootstrap
