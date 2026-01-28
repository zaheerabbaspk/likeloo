import { Server, Socket } from 'socket.io';

interface LiveRoom {
    broadcasterId: string;
    viewers: Set<string>;
    broadcasterSocket?: Socket;
}

const liveRooms: Map<string, LiveRoom> = new Map();

interface ActivePK {
    streamerA: string;
    streamerB: string;
    scoreA: number;
    scoreB: number;
    startTime: number;
}

const activePKs: Map<string, ActivePK> = new Map();

export const initializeLiveSocket = (io: Server) => {
    const liveNamespace = io.of('/live');

    liveNamespace.on('connection', (socket: Socket) => {
        console.log('[LIVE] New socket connection:', socket.id);

        // Start Broadcast
        socket.on('start-broadcast', (data: { streamerId: string, streamerName: string }) => {
            console.log('[LIVE] Start broadcast:', data.streamerId);
            socket.join(data.streamerId);
            socket.data.roomId = data.streamerId;
            socket.data.role = 'broadcaster';

            liveRooms.set(data.streamerId, {
                broadcasterId: data.streamerId,
                viewers: new Set(),
                broadcasterSocket: socket
            });
        });

        // Join Stream
        socket.on('join-stream', (data: { streamerId: string, viewerId: string }) => {
            console.log(`[LIVE] User ${data.viewerId} joining room ${data.streamerId}`);
            socket.join(data.streamerId);
            socket.data.roomId = data.streamerId;
            socket.data.role = 'viewer';

            const room = liveRooms.get(data.streamerId);
            if (room) {
                room.viewers.add(socket.id);
                // Notify broadcaster that a viewer joined
                room.broadcasterSocket?.emit('viewer-joined', {
                    viewerId: data.viewerId,
                    socketId: socket.id
                });
                // Update viewer count for everyone in the room
                liveNamespace.to(data.streamerId).emit('viewer-count', { count: room.viewers.size });
            }
        });

        // WebRTC: Offer (from Broadcaster to Viewer or between PK streamers)
        socket.on('offer', (data: { targetSocketId: string, sdp: any }) => {
            console.log(`[WebRTC] Relay offer from ${socket.id} to ${data.targetSocketId}`);
            socket.to(data.targetSocketId).emit('offer', {
                sdp: data.sdp,
                broadcasterSocketId: socket.id
            });
        });

        // WebRTC: Answer
        socket.on('answer', (data: { targetSocketId: string, sdp: any }) => {
            console.log(`[WebRTC] Relay answer from ${socket.id} to ${data.targetSocketId}`);
            socket.to(data.targetSocketId).emit('answer', {
                sdp: data.sdp,
                viewerSocketId: socket.id
            });
        });

        // WebRTC: ICE Candidate
        socket.on('ice-candidate', (data: { targetSocketId: string, candidate: any }) => {
            socket.to(data.targetSocketId).emit('ice-candidate', {
                candidate: data.candidate,
                fromSocketId: socket.id
            });
        });

        // Chat Message
        socket.on('chat-message', (data: { streamerId: string, message: string, senderName: string, senderAvatar: string }) => {
            liveNamespace.to(data.streamerId).emit('chat-message', data);
        });

        // Gift Sent (PK Logic included)
        socket.on('send-gift', (data: { streamerId: string, giftName: string, giftIcon: string, senderName: string, senderAvatar: string, coins: number }) => {
            liveNamespace.to(data.streamerId).emit('gift-received', {
                giftName: data.giftName,
                giftIcon: data.giftIcon,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                coins: data.coins,
                timestamp: Date.now()
            });

            const pk = activePKs.get(data.streamerId);
            if (pk) {
                if (data.streamerId === pk.streamerA) {
                    pk.scoreA += data.coins;
                } else {
                    pk.scoreB += data.coins;
                }

                const scorePayload = {
                    streamerA: pk.streamerA,
                    scoreA: pk.scoreA,
                    streamerB: pk.streamerB,
                    scoreB: pk.scoreB
                };

                liveNamespace.to(pk.streamerA).emit('pk-score-update', scorePayload);
                liveNamespace.to(pk.streamerB).emit('pk-score-update', scorePayload);
            }
        });

        // PK BATTLE: Invite
        socket.on('pk-invite', (data: { targetStreamerId: string, requestingStreamerId: string, requestingStreamerName: string }) => {
            const targetRoom = liveRooms.get(data.targetStreamerId);
            if (targetRoom && targetRoom.broadcasterSocket) {
                console.log(`[PK] Invite from ${data.requestingStreamerId} to ${data.targetStreamerId}`);
                targetRoom.broadcasterSocket.emit('pk-invite-received', {
                    streamerId: data.requestingStreamerId,
                    streamerName: data.requestingStreamerName
                });
            }
        });

        // PK BATTLE: Accept
        socket.on('pk-accept', (data: { targetStreamerId: string, acceptingStreamerId: string }) => {
            const requesterRoom = liveRooms.get(data.targetStreamerId);
            const accepterRoom = liveRooms.get(data.acceptingStreamerId);

            if (requesterRoom && accepterRoom) {
                console.log(`[PK] Accepted between ${data.targetStreamerId} and ${data.acceptingStreamerId}`);

                const newPK: ActivePK = {
                    streamerA: data.targetStreamerId,
                    streamerB: data.acceptingStreamerId,
                    scoreA: 0,
                    scoreB: 0,
                    startTime: Date.now()
                };

                activePKs.set(data.targetStreamerId, newPK);
                activePKs.set(data.acceptingStreamerId, newPK);

                requesterRoom.broadcasterSocket?.emit('pk-started', { otherStreamerId: data.acceptingStreamerId });
                accepterRoom.broadcasterSocket?.emit('pk-started', { otherStreamerId: data.targetStreamerId });

                liveNamespace.to(data.targetStreamerId).emit('pk-mode-active', { otherStreamerId: data.acceptingStreamerId });
                liveNamespace.to(data.acceptingStreamerId).emit('pk-mode-active', { otherStreamerId: data.targetStreamerId });
            }
        });

        // PK BATTLE: Reject
        socket.on('pk-reject', (data: { targetStreamerId: string }) => {
            const targetRoom = liveRooms.get(data.targetStreamerId);
            if (targetRoom) {
                targetRoom.broadcasterSocket?.emit('pk-rejected');
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            const roomId = socket.data.roomId;
            const role = socket.data.role;

            if (role === 'broadcaster' && roomId) {
                liveRooms.delete(roomId);
                activePKs.delete(roomId);
                liveNamespace.to(roomId).emit('stream-ended');
                console.log('[LIVE] Broadcaster disconnected:', roomId);
            } else if (role === 'viewer' && roomId) {
                const room = liveRooms.get(roomId);
                if (room) {
                    room.viewers.delete(socket.id);
                    liveNamespace.to(roomId).emit('viewer-count', { count: room.viewers.size });
                }
            }
        });
    });

    console.log('[LIVE] Socket.IO Live namespace initialized');
};

export const getActiveStreams = () => {
    return Array.from(liveRooms.entries()).map(([id, room]) => ({
        streamerId: id,
        viewerCount: room.viewers.size
    }));
};
