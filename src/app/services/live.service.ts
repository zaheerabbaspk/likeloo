import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { SupabaseService } from './supabase.service';

@Injectable({
    providedIn: 'root'
})
export class LiveService {
    private socket: Socket | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    public localStream: MediaStream | null = null;

    // State Observables
    public isBroadcasting$ = new BehaviorSubject<boolean>(false);
    public remoteStream$ = new BehaviorSubject<MediaStream | null>(null);
    public viewerCount$ = new BehaviorSubject<number>(0);
    public chatMessages$ = new Subject<{ senderName: string, message: string, senderAvatar: string }>();
    public giftsReceived$ = new Subject<{ giftName: string, giftIcon: string, senderName: string, coins: number }>();
    public streamEnded$ = new Subject<void>();

    // PK Observables
    public pkStream$ = new BehaviorSubject<MediaStream | null>(null);
    public pkRequest$ = new Subject<{ streamerId: string, streamerName: string }>();
    public isPkMode$ = new BehaviorSubject<boolean>(false);
    public pkScore$ = new Subject<{ streamerA: string, scoreA: number, streamerB: string, scoreB: number }>();

    private currentStreamerId: string | null = null;
    private readonly STUN_SERVERS: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ];

    constructor(private supabaseService: SupabaseService) { }

    connect() {
        if (this.socket?.connected) return;

        this.socket = io('http://localhost:5002/live', {
            transports: ['websocket']
        });

        this.setupSocketListeners();
        console.log('[LiveService] Connected to signaling server');
    }

    disconnect() {
        this.socket?.disconnect();
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.localStream?.getTracks().forEach(t => t.stop());
        this.localStream = null;
        console.log('[LiveService] Disconnected');
    }

    private setupSocketListeners() {
        if (!this.socket) return;

        // PK BATTLE: Received Invite
        this.socket.on('pk-invite-received', (data) => {
            console.log('[PK] Invite received:', data);
            this.pkRequest$.next(data);
        });

        // PK BATTLE: Started (For Streamers)
        this.socket.on('pk-started', (data: { otherStreamerId: string }) => {
            console.log('[PK] Battle Started! Connecting to:', data.otherStreamerId);
            this.isPkMode$.next(true);
            this.joinStream(data.otherStreamerId, this.currentStreamerId || 'anon');
        });

        // PK BATTLE: Active (For Viewers)
        this.socket.on('pk-mode-active', (data: { otherStreamerId: string }) => {
            console.log('[PK] Viewer detecting PK mode. Joining second stream:', data.otherStreamerId);
            this.isPkMode$.next(true);
            this.joinStream(data.otherStreamerId, 'viewer-' + Date.now());
        });

        // PK Score Update
        this.socket.on('pk-score-update', (data) => {
            this.pkScore$.next(data);
        });

        // Viewer joined (broadcaster receives this)
        this.socket.on('viewer-joined', async (data: { viewerId: string, socketId: string }) => {
            console.log('[LiveService] Viewer joined:', data.viewerId);
            await this.createOfferForViewer(data.socketId);
        });

        // Offer received (viewer receives this)
        this.socket.on('offer', async (data: { sdp: RTCSessionDescriptionInit, broadcasterSocketId: string }) => {
            console.log('[LiveService] Received offer from:', data.broadcasterSocketId);
            await this.handleOffer(data.sdp, data.broadcasterSocketId);
        });

        // Answer received (broadcaster receives this)
        this.socket.on('answer', async (data: { sdp: RTCSessionDescriptionInit, viewerSocketId: string }) => {
            const pc = this.peerConnections.get(data.viewerSocketId);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
        });

        // ICE Candidate
        this.socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit, fromSocketId: string }) => {
            const pc = this.peerConnections.get(data.fromSocketId);
            if (pc && data.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        // Chat message
        this.socket.on('chat-message', (data) => {
            this.chatMessages$.next(data);
        });

        // Gift received
        this.socket.on('gift-received', (data) => {
            this.giftsReceived$.next(data);
        });

        // Viewer count update
        this.socket.on('viewer-count', (data: { count: number }) => {
            this.viewerCount$.next(data.count);
        });

        // Stream ended
        this.socket.on('stream-ended', () => {
            this.streamEnded$.next();
        });
    }

    // ========== PK METHODS ==========

    requestPK(targetStreamerId: string, requestingStreamerName: string) {
        if (!this.currentStreamerId) return;
        this.socket?.emit('pk-invite', {
            targetStreamerId,
            requestingStreamerId: this.currentStreamerId,
            requestingStreamerName
        });
    }

    acceptPK(targetStreamerId: string) {
        if (!this.currentStreamerId) return;
        this.socket?.emit('pk-accept', {
            targetStreamerId, // The one who invited me
            acceptingStreamerId: this.currentStreamerId // Me
        });
    }

    // ========== BROADCASTER METHODS ==========

    async startBroadcast(streamerId: string, streamerName: string, avatarUrl: string, mediaStream: MediaStream) {
        this.connect();
        this.localStream = mediaStream;

        // Wait for socket to connect
        await new Promise<void>(resolve => {
            if (this.socket?.connected) {
                resolve();
            } else {
                this.socket?.on('connect', () => resolve());
            }
        });

        this.socket?.emit('start-broadcast', { streamerId, streamerName });
        this.isBroadcasting$.next(true);
        this.currentStreamerId = streamerId;

        // Start Supabase Session
        try {
            await this.supabaseService.startSession(
                streamerId,
                streamerId,
                streamerName,
                avatarUrl
            );
        } catch (e) {
            console.error('Failed to start Supabase session', e);
        }

        console.log('[LiveService] Broadcast started');
    }

    private async createOfferForViewer(viewerSocketId: string) {
        const pc = this.createPeerConnection(viewerSocketId);

        // Add local tracks
        this.localStream?.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream!);
        });

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket?.emit('offer', {
            targetSocketId: viewerSocketId,
            sdp: pc.localDescription
        });
    }

    async endBroadcast() {
        this.socket?.emit('end-broadcast');
        this.isBroadcasting$.next(false);

        if (this.currentStreamerId) {
            try {
                await this.supabaseService.endSession(this.currentStreamerId);
            } catch (e) {
                console.error('Failed to end Supabase session', e);
            }
            this.currentStreamerId = null;
        }

        this.disconnect();
    }

    // ========== VIEWER METHODS ==========

    async joinStream(streamerId: string, viewerId: string) {
        this.connect();

        // Wait for socket to connect
        await new Promise<void>(resolve => {
            if (this.socket?.connected) {
                resolve();
            } else {
                this.socket?.on('connect', () => resolve());
            }
        });

        this.socket?.emit('join-stream', { streamerId, viewerId });
        console.log('[LiveService] Joined stream:', streamerId);
    }

    private async handleOffer(sdp: RTCSessionDescriptionInit, broadcasterSocketId: string) {
        const pc = this.createPeerConnection(broadcasterSocketId);

        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('[LiveService] Received remote track from:', broadcasterSocketId);

            if (this.currentStreamerId) {
                // Broadcaster receiving PK stream
                this.pkStream$.next(event.streams[0]);
            } else {
                // Viewer logic
                if (this.remoteStream$.value) {
                    console.log('[LiveService] Setting as PK Stream');
                    this.pkStream$.next(event.streams[0]);
                } else {
                    console.log('[LiveService] Setting as Main Stream');
                    this.remoteStream$.next(event.streams[0]);
                }
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket?.emit('answer', {
            targetSocketId: broadcasterSocketId,
            sdp: pc.localDescription
        });
    }

    // ========== SHARED METHODS ==========

    private createPeerConnection(targetSocketId: string): RTCPeerConnection {
        const pc = new RTCPeerConnection({
            iceServers: this.STUN_SERVERS
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket?.emit('ice-candidate', {
                    targetSocketId,
                    candidate: event.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[LiveService] Connection state:', pc.connectionState);
        };

        this.peerConnections.set(targetSocketId, pc);
        return pc;
    }

    sendChatMessage(streamerId: string, message: string, senderName: string, senderAvatar: string) {
        this.socket?.emit('chat-message', { streamerId, message, senderName, senderAvatar });
    }

    sendGift(streamerId: string, giftName: string, giftIcon: string, senderName: string, senderAvatar: string, coins: number) {
        // Emit locally for immediate feedback if needed, but primarily send to server
        this.socket?.emit('send-gift', { streamerId, giftName, giftIcon, senderName, senderAvatar, coins });
    }
}
