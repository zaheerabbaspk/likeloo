import { Router } from 'express';
import * as ChatController from '../controllers/chat.controller';

const router = Router();

console.log('[DEBUG] Registering Chat Routes...');

router.get('/test', (req, res) => {
    res.json({ message: 'Chat routes working!' });
});

router.post('/send', ChatController.sendMessage);
router.get('/conversations/:userId', ChatController.getConversations);
router.post('/seen', ChatController.markAsSeen);

export default router;
