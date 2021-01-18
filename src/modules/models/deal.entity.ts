import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm'

/*
        /------> Missing       <--\
  Sent --------> Pending <---------|
       \-------> Committed     <--/
 */
export enum DealStatus {
  Sent,
  Committed,
  CutOff,
}

@Entity()
export class Deal {

  @Column('varchar',{name:'id',generated:'increment'})
  id!:string

  // this deal's tx hash
  @PrimaryColumn('varchar', { name: 'tx_hash' })
  txHash!: string

  // easy for backwards retrieve
  @Column('varchar',{ name: 'pre_tx_hahs' })
  preTxHash!: string

  // the tx, used to re-send the tx, in JSON format
  @Column('varchar', {name: 'tx'})
  tx!: string

  // the info_cell this deal finishes, in JSON format
  @Column('varchar',{name:'info'})
  info!: string

  // the pool_cell this deal finishes, in JSON format
  @Column('varchar',{name:'pool'})
  pool!: string

  // the matcher_change_cell this deal finishes, in JSON format
  @Column('varchar',{name:'matcher_change'})
  matcher_change!: string


  //处理了哪些req,[xxxx-x,xxxx-x,xxxx-x]
  @Column('varchar', { name: 'req_outpoint' })
  reqOutpoints!: string

  //只有deal有状态,order依赖于deal,没有状态
  @Column('int8',{ name: 'staus' })
  status!: DealStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
