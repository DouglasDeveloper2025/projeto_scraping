import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity('success_log')
export class SuccessLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'jsonb'})
    payload: any;

    @Column()
    @CreateDateColumn()
    createdAt: Date;
}

export default SuccessLog
