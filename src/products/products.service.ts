import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

import { Product, ProductImage } from './entities';
import { validate as isUUID } from 'uuid';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService')

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource 
  ) { }

  async create(createProductDto: CreateProductDto, user: User) {
    try {
      const {images = [], ...productDetails} = createProductDto
      const product = this.productRepository.create({
        ...productDetails,
        user,
        images: images.map(image => this.productImageRepository.create({url: image}))//typeorm infiere el productid
      });
      await this.productRepository.save(product); // guarada tanto el producto como imagen
      return {...product, images};
    } catch (error) {
      this.handleDBExeptions(error)
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const {limit = 10, offset = 0} = paginationDto;
    const products = await this.productRepository.find({ //FINoPTIONS
      take: limit,
      skip: offset,
      relations: {
        images: true,
      },
      order: {
        title: 'ASC'
      }
    })
    return products.map(({images, ...res}) => ({
      ...res,
      images: images.map( img => img.url)
    }))
  }

  async findOne(term: string) {
    let product: Product;
    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({id: term});
    }
    else  {
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where('UPPER(title)=:title or slug=:slug', {
          title: term.toUpperCase(),
          slug: term.toLowerCase()
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if (!product) throw new NotFoundException(`Product with term '${term}' not found`)
    // return {...product, images: product.images.map(image => image.url)}
    return product;
  }

  async findOnePlain(term: string) {
    const {images=[], ...rest} = await this.findOne(term);
    return {
      ...rest,
      images: images.map(image => image.url)
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto, user: User) {
    const {images, ...toUpdate} = updateProductDto;
    const product = await this.productRepository.preload({id, ...toUpdate});
    if(!product) throw new NotFoundException(`Product with id '${id}' not found`);

    // Create query runner: https://orkhan.gitbook.io/typeorm/docs/insert-query-builder
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if(images) {
        await queryRunner.manager.delete(ProductImage, {product: {id}});
        product.images = images.map(image => this.productImageRepository.create({url: image}));
      }
      product.user = user;
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      // await this.productRepository.save(product);
      // return product;

      return this.findOnePlain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();

      this.handleDBExeptions(error);
    }
  }

  async remove(id: string) {
    const { affected }  = await this.productRepository.delete({id: id});
    if(affected===0) throw new NotFoundException(`Product with id '${id}' not found`);
    return {success: 'Deleted'}
  }

  private handleDBExeptions(error: any) {
    if (error.code === '23505')
      throw new BadRequestException(error.detail);

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, check server logs');
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product');
    try {
      return await query
      .delete()
      .where({})
      .execute();
    } catch (error) {
      this.handleDBExeptions(error)
    }
  }
}
