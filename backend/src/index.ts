import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/auth.routes';
import videoRoutes from './routes/video.routes';
import userRoutes from './routes/user.routes';
import * as ChatController from './controllers/chat.controller';
import { initializeLiveSocket } from './controllers/live.controller';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP Server for Socket.IO
const httpServer = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Initialize Live Streaming Socket
initializeLiveSocket(io);

// ULTRA-VERBOSE LOGGING (Must be first)
app.use((req, res, next) => {
    console.log(`[ULTRA] ${req.method} ${req.url}`);
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Init Uploads Folder (Absolute Path Safety)
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Request Logger
app.use((req, res, next) => {
    console.log(`[LOG] ${req.method} ${req.url}`);
    next();
});

// Routes
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        console.log(`[API-TRACE] ${req.method} ${req.url}`);
    }
    next();
});

// DIRECT CHAT ROUTES (Highest Priority)
app.post('/api/chat/send', ChatController.sendMessage);
app.get('/api/chat/conversations/:userId', ChatController.getConversations);
app.post('/api/chat/seen', ChatController.markAsSeen);

// Other Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'Toko API Active - WebRTC LIVE v2.0.0',
        version: '2.0.0-LIVE',
        features: ['Chat', 'WebRTC Live Streaming'],
        timestamp: new Date().toISOString()
    });
});

app.post('/api/ping', (req, res) => {
    res.json({ message: 'Pong! Direct API is alive.' });
});

// Final 404 Handler
app.use((req, res) => {
    console.warn(`[404] ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler (EXPLICIT JSON FOR DEBUGGING)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[CRITICAL UPLOAD FAILURE]', err);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error detected by Toko-Shield',
        error: err.toString(),
        code: err.code || 'UNKNOWN_ERROR',
        path: err.path || 'N/A',
        stack: err.stack
    });
});

// Use httpServer instead of app.listen for Socket.IO
httpServer.listen(PORT, () => {
    console.log(`[SUCCESS] Toko Server with WebRTC Live listening on port ${PORT}`);
});

// FORCE PROCESS TO STAY ALIVE
setInterval(() => {
    // Keep event loop active
}, 50000);

