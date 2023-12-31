import { ExecutionContext, InternalServerErrorException, createParamDecorator } from "@nestjs/common";

export const GetUser = createParamDecorator(
    (data: string, ctx: ExecutionContext) => { // data: los argumentos que se le mandan al GetUser, ctx: para obtener la request
        
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        if(!user) throw new InternalServerErrorException('User not found {request}')
        return (!data) ? user : user[data];
    }
)