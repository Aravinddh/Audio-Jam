FROM node:18

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY package*.json ./
COPY . .

RUN npm install

EXPOSE 5000
CMD ["node", "server.js"]
