import { injectable } from 'inversify'
import { EntityRepository, Repository } from 'typeorm'
import { Deal, DealStatus } from '../models/entities/deal.entity'

@injectable()
@EntityRepository(Deal)
class DealRepository extends Repository<Deal> {
  saveDeal = async (deal: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal> => {
    const dealTosave: Deal = this.create(deal)
    return this.save(dealTosave)
  }

  updateDealStatus = async (txHash: string, status: DealStatus) => {
    await this.update(txHash, { status })
  }

  getByTxHahs = async (txHash: string): Promise<Deal | null> => {
    return (
      (await this.findOne({
        where: {
          txHash: txHash,
        },
      })) || null
    )
  }

  getByPreTxHahs = async (preTxHash: string): Promise<Deal | null> => {
    return (
      (await this.findOne({
        where: {
          preTxHash: preTxHash,
        },
      })) || null
    )
  }

  getAllSentDeals = async (): Promise<Array<Deal>> => {
    return await this.find({
      where: {
        status: DealStatus.Sent,
      },
      order: {
        id: 'ASC',
      },
    })
  }
}

export default DealRepository
