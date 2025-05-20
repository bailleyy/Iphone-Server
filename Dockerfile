FROM node:22

WORKDIR /usr/src/app

COPY --chown=node:node package.json ./
RUN npm install --production

COPY --chown=node:node src/ ./src/

USER node

EXPOSE 150
CMD ["npm", "run", "prod"]