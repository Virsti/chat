// Библиотеки
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключаем Fastify
const fastify = Fastify({
	logger: {
		level: 'info',
		transport: {
			target: 'pino-pretty',
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
	root: path.join(__dirname, 'client'),
	prefix: '/',
});

// Хранилище подключенных клиентов
const clients = new Set();

// Создаем WebSocket сервер отдельно
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', function connection(ws) {
	console.log('Client connected');
	const userId = new Date().getTime()+Math.random().toString(36).substr(2,5)
	clients.add(ws);

	// Отправляем приветственное сообщение
	ws.send(
		JSON.stringify({
			type: 'system',
			data: 'Connected to chat',
			timestamp: new Date().toLocaleTimeString(),
			userId: userId
		})
	);

	// Обработка сообщений от клиента
	ws.on('message', function message(data) {
		console.log('Received:', data.toString());

		const messageData = JSON.stringify({
			type: 'message',
			data: data.toString(),
			timestamp: new Date().toLocaleTimeString(),
			userId: userId
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

	ws.on('error', function error(err) {
		console.error('WebSocket error:', err);
		clients.delete(ws);
	});
});

// Обработка upgrade запросов для WebSocket
fastify.server.on('upgrade', (request, socket, head) => {
	const pathname = new URL(request.url, 'http://localhost').pathname;

	if (pathname === '/ws') {
		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit('connection', ws, request);
		});
	} else {
		socket.destroy();
	}
});

// Создаём запрос по умолчанию
fastify.get('/', async (request, reply) => {
	return reply.sendFile('index.html');
});

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
