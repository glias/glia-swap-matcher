FROM node:12

WORKDIR /app

ADD package.json .
ADD ormconfig.yml.example ./ormconfig.yml
ADD yarn.lock .
ADD tsconfig.json .
ADD src ./src
ADD configs ./configs

RUN yarn install
RUN yarn build

EXPOSE 8080

CMD [ "npm", "run", "start:glia:prod" ]
