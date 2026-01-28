import { Request, Response } from 'express';

const RTDB_URL = process.env.FIREBASE_RTDB_URL?.replace(/\/$/, '') || 'https://likelo-27611-default-rtdb.asia-southeast1.firebasedatabase.app';

// Helper to interact with Firebase RTDB via REST (Duplicate from video controller for independence)
const firebaseFetch = async (path: string, options: any = {}) => {
    const url = `${RTDB_URL}/${path}.json`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firebase Error: ${response.statusText} - ${errorText}`);
    }
    return response.json();
};

export const sendMessage = async (req: Request, res: Response) => {
    console.log('[CHAT-CTRL] Processing sendMessage request...');
    try {
        const { senderId, receiverId, text, senderName, senderPhoto, receiverName, receiverPhoto } = req.body;

        if (!senderId || !receiverId || !text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const chatId = [senderId, receiverId].sort().join('_');
        const messageId = Date.now().toString();

        const messageData = {
            id: messageId,
            senderId,
            receiverId,
            text,
            timestamp: Date.now(),
            seen: false
        };

        // 1. Save message to chat history
        await firebaseFetch(`chats/${chatId}/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify(messageData)
        });

        // 2. Update last message in BOTH users conversation lists
        const lastMsgUpdate = {
            lastMessage: text,
            lastTimestamp: Date.now(),
            unread: true,
            otherUser: {
                uid: senderId,
                displayName: senderName || 'User',
                photoURL: senderPhoto || ''
            }
        };

        // Update for Receiver (They see Sender)
        await firebaseFetch(`conversations/${receiverId}/${senderId}`, {
            method: 'PATCH',
            body: JSON.stringify(lastMsgUpdate)
        });

        // Update for Sender (They see Receiver)
        await firebaseFetch(`conversations/${senderId}/${receiverId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                lastMessage: text,
                lastTimestamp: Date.now(),
                unread: false,
                otherUser: {
                    uid: receiverId,
                    displayName: receiverName || 'User',
                    photoURL: receiverPhoto || ''
                }
            })
        });

        res.status(200).json(messageData);
    } catch (error: any) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const data = await firebaseFetch(`conversations/${userId}`);
        const conversations = data ? Object.values(data).sort((a: any, b: any) => b.lastTimestamp - a.lastTimestamp) : [];
        res.status(200).json(conversations);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const markAsSeen = async (req: Request, res: Response) => {
    try {
        const { userId, otherUserId } = req.body;
        await firebaseFetch(`conversations/${userId}/${otherUserId}`, {
            method: 'PATCH',
            body: JSON.stringify({ unread: false })
        });
        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

