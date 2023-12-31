import { Injectable } from '@nestjs/common';
import { ProductsService } from 'src/products/products.service';
import { initialData } from './data/seed-data';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SeedService {

  constructor(
    private readonly productsServices: ProductsService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {

  }
  async runSeed() {
    await this.deleteTables();
    const adminUser = await this.insertUsers();
    await this.insertNewProducts(adminUser);
    return 'Seed Executed';
  }

  private async deleteTables() {
    await this.productsServices.deleteAllProducts();
    const queryBuilder = this.userRepository.createQueryBuilder();
    await queryBuilder
    .delete()
    .where({})
    .execute()
  }

  private async insertUsers() {
    const seedUsers = initialData.users;
    const users: User[] = [];
    seedUsers.forEach(user => {
      users.push(this.userRepository.create(user));
    })
    await this.userRepository.save(users);
    // await this.userRepository.save(seedUsers);
    return users[0];
  }
  
  private async insertNewProducts(user: User) {
    await this.productsServices.deleteAllProducts();
    const products = initialData.products;
    const insertPromises = [];
    products.forEach(product => {
      insertPromises.push(this.productsServices.create(product, user));
    });
    await Promise.all(insertPromises);
    return true;
  }
}
