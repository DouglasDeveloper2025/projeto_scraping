import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn} from "typeorm"

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    proxy: string;
    unique: true

    @Column()
    ultimaVezUtilizado: Date;

    @Column()
    vencimentoPrevisto: Date;

    @Column()
    requisicoesFeitas: number;

    @Column()
    @CreateDateColumn()
    createdAt: Date;

    @Column()
    @UpdateDateColumn()
    updatedAt: Date;

}

export default User;