// Библиотеки
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const _filename = fileURLToPath(import.meta.url); //имя текущего файла
const _dirname = path.dirname(_filename); // смотр в какой папке находится этот файл

// Подключаем Fastify
const fastify = Fastify({
	logger: {
		level: 'info',
		transport: {
			target: 'pino-pretty', //библиотека для красивого вывода сообщений в консоль
		},
	},
});

// Ядро Fastify
await fastify.register(fastifyCors, {
	origin: '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
await fastify.register(fastifyFormbody);

// Serve static files
fastify.register(import('@fastify/static'), {
	root: path.join(_dirname, 'client'),
	prefix: '/',
});

// Хранилище подключенных клиентов
const clients = new Set();

// Создаем WebSocket сервер отдельно
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', function connection(ws) {
	console.log('Client connected');
	clients.add(ws);

	//Отправляем приветственное сообщение
	ws.send(JSON.stringify({
    type: "system",
    data:"Connected to chat",
    timestamp: new Data().toLocaleTimeString(),
  }));

  //Обработка сообщений от клиента 
  ws.on("massage", function massage(data){
    console.log("Received:", data.toString());

    const messageData = JSON.stringify({
      type: "massage",
      data: data.toString(),
      timastamp: new Date().tolocaleTimeSring(),
    });

		// Отправляем сообщение всем подключенным клиентам
		clients.forEach((client) => {
			if (client.readyState === 1) {
				// 1 = OPEN
				client.send(messageData);
			}
		});
	});

	// Обработка отключения клиента
	ws.on('close', function close() {
		console.log('Client disconnected');
		clients.delete(ws);
	});

  ws.on("error", function error(err){
    console.error("WebSocket:", err);
    clients.selete(ws);
  });
}); 

//Оброботка upgrade запрос для WebSocket 
fastify.server.on("upgrade", (request, socket, haed) => {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (pathname === "/ws"){
    wss.handleUpgrade(request, socket, haed, ws => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
})

// Health check endpoint
fastify.get('/health', async (request, reply) => {
	return { status: 'OK', clients: clients.size };
});

// Команда запуска сервера
const start = async () => {
	try {
		await fastify.listen({
			port: 3000,
			host: '0.0.0.0',
		});
		console.log('Server started http://localhost:3000');
		console.log('WebSocket available at ws://localhost:3000/ws');
	} catch (err) {
		console.log('error: ', err);
		process.exit(1);
	}
};

start();
