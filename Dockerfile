FROM node:12

WORKDIR /app

ADD package.json .
ADD ormconfig.yml .
ADD yarn.lock .
ADD tsconfig.json .
ADD src ./src

RUN yarn install
RUN yarn build:dev

EXPOSE 8080

CMD [ "node", "./lib/index.js" ]
