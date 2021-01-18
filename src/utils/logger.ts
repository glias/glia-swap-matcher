import winston, { format, transports } from 'winston'
import { NODE_ENV } from './const'

export const logger = winston.createLogger({
  level: NODE_ENV === 'development' ? 'debug' : 'info',
  format: format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console(), new transports.File({ filename: 'error.log', level: 'error' })],
})
