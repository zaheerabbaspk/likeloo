import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import {
    closeOutline, heart, chatbubble, gift, send, chevronDown,
    trophy, sparkles, flash, people
} from 'ionicons/icons';
import { LiveService } from '../../services/live.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-live',
    templateUrl: './live.page.html',
    styleUrls: ['./live.page.scss'],
    standalone: true,
    imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class LivePage implements OnInit, OnDestroy {
    @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('pkVideo') pkVideoRef!: ElementRef<HTMLVideoElement>;

    comment = '';
    streamerId = '';

    // Streamer Info
    streamer = {
        name: 'Broadcaster',
        avatar: 'https://i.pravatar.cc/100?u=broadcaster',
        followers: '0',
        coins: 0
    };

    viewerCount = 0;
    isConnected = false;
    isPkMode = false;

    // PK State
    pkProgress = 50; // Percentage for host
    pkOpponentScore = 0;

    activeGiftAnimation: string | null = null;

    gifts = [
        { id: 1, name: 'Rose', icon: '🌹', coins: 1 },
        { id: 2, name: 'Lion', icon: '🦁', coins: 100 },
        { id: 3, name: 'Heart', icon: '❤️', coins: 10 },
        { id: 4, name: 'Star', icon: '⭐', coins: 50 },
        { id: 5, name: 'Crown', icon: '👑', coins: 500 },
        { id: 6, name: 'Rocket', icon: '🚀', coins: 1000 },
        { id: 7, name: 'Flower', icon: '🌸', coins: 5 } // 3D Flower
    ];

    liveComments: { user: string, text: string, avatar: string, isJoin?: boolean }[] = [];

    // Gifter tracking
    topGiftersA: { name: string, avatar: string, total: number }[] = [];
    topGiftersB: { name: string, avatar: string, total: number }[] = [];

    private subscriptions: Subscription[] = [];

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private liveService: LiveService,
        private authService: AuthService,
        private toastCtrl: ToastController,
        private supabaseService: SupabaseService
    ) {
        addIcons({ closeOutline, heart, chatbubble, gift, send, chevronDown, trophy, sparkles, flash, people });
    }

    ngOnInit() {
        // Get streamer ID from route
        this.streamerId = this.route.snapshot.params['id'] || 'test-stream';

        this.joinStream();
        this.setupSubscriptions();
    }

    async joinStream() {
        const user = this.authService.getCurrentUser();
        const viewerId = user?.uid || 'anonymous-' + Date.now();

        await this.liveService.joinStream(this.streamerId, viewerId);

        // Add join message
        this.liveComments.push({
            user: 'You',
            text: 'joined the stream',
            avatar: user?.photoURL || 'https://i.pravatar.cc/30?u=me',
            isJoin: true
        });
    }

    setupSubscriptions() {
        // Remote stream (WebRTC video)
        this.subscriptions.push(
            this.liveService.remoteStream$.subscribe(stream => {
                if (stream && this.remoteVideoRef) {
                    console.log('[LivePage] Setting Main Stream');
                    this.remoteVideoRef.nativeElement.srcObject = stream;
                    this.isConnected = true;
                    this.remoteVideoRef.nativeElement.play().catch(e => console.error('Play Main Error', e));
                }
            })
        );

        // PK Mode Active
        this.subscriptions.push(
            this.liveService.isPkMode$.subscribe(isActive => {
                this.isPkMode = isActive;
            })
        );

        // PK Stream (Second Video)
        this.subscriptions.push(
            this.liveService.pkStream$.subscribe(stream => {
                if (stream && this.pkVideoRef) {
                    console.log('[LivePage] Setting PK Stream');
                    this.pkVideoRef.nativeElement.srcObject = stream;
                    this.pkVideoRef.nativeElement.play().catch(e => console.error('Play PK Error', e));
                }
            })
        );

        // Viewer count
        this.subscriptions.push(
            this.liveService.viewerCount$.subscribe(count => {
                this.viewerCount = count;
            })
        );

        // Subscribe to Supabase Live Comments
        this.subscriptions.push(
            this.supabaseService.subscribeToLiveComments(this.streamerId).subscribe((comment: any) => {
                this.liveComments.push({
                    user: comment.full_name || 'Anonymous',
                    text: comment.message,
                    avatar: comment.avatar_url || 'https://i.pravatar.cc/30'
                });
                if (this.liveComments.length > 50) this.liveComments.shift();
            })
        );

        // Subscribe to Live Likes
        this.subscriptions.push(
            this.supabaseService.subscribeToLiveLikes(this.streamerId).subscribe((payload: any) => {
                this.showHeartAnimation();
                this.streamer.coins += payload.count || 1; // Increment hearts/coins (Visual only for likes)
                this.calculatePkProgress();
            })
        );

        // Gifts received (Just for chat log and animation)
        this.subscriptions.push(
            this.liveService.giftsReceived$.subscribe((gift: any) => {
                this.liveComments.push({
                    user: gift.senderName,
                    text: `sent ${gift.giftIcon} ${gift.giftName}`,
                    avatar: gift.senderAvatar || 'https://i.pravatar.cc/30'
                });

                // Update Top Gifters logic
                if (this.isPkMode) {
                    this.updateGifterStats(gift);
                }
            })
        );

        // REAL PK SCORES
        this.subscriptions.push(
            this.liveService.pkScore$.subscribe(scoreData => {
                if (scoreData) {
                    console.log('[LivePage] PK Score Update:', scoreData);

                    if (this.streamerId === scoreData.streamerA) {
                        this.streamer.coins = scoreData.scoreA;
                        this.pkOpponentScore = scoreData.scoreB;
                    } else if (this.streamerId === scoreData.streamerB) {
                        this.streamer.coins = scoreData.scoreB;
                        this.pkOpponentScore = scoreData.scoreA;
                    }

                    this.calculatePkProgress();
                }
            })
        );

        // Stream ended
        this.subscriptions.push(
            this.liveService.streamEnded$.subscribe(() => {
                this.showToast('Stream has ended');
                this.close();
            })
        );
    }

    calculatePkProgress() {
        const total = this.streamer.coins + this.pkOpponentScore;
        if (total === 0) {
            this.pkProgress = 50;
        } else {
            this.pkProgress = (this.streamer.coins / total) * 100;
        }
    }

    updateGifterStats(gift: any) {
        // Find which side the gift was for
        // In this implementation, the backend emits 'gift-received' to the targeted room
        // If the viewer is in streamerId's room, we need to know if gift.streamerId matches
        // For simplicity, we'll track based on matching IDs

        const isForA = gift.streamerId === this.streamerId;
        const targetList = isForA ? this.topGiftersA : this.topGiftersB;

        const existing = targetList.find(g => g.name === gift.senderName);
        if (existing) {
            existing.total += gift.coins;
        } else {
            targetList.push({
                name: gift.senderName,
                avatar: gift.senderAvatar || `https://i.pravatar.cc/30?u=${gift.senderName}`,
                total: gift.coins
            });
        }

        // Sort and keep top 3
        targetList.sort((a, b) => b.total - a.total);
        if (targetList.length > 3) targetList.pop();
    }

    handleDoubleTap(event: any) {
        const user = this.authService.getCurrentUser();
        this.supabaseService.sendLiveLike(this.streamerId, user?.uid);
        this.showHeartAnimation();
    }

    showHeartAnimation() {
        // Simple logic to add a temporary heart element to DOM
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.position = 'absolute';
        heart.style.bottom = '100px';
        heart.style.right = '20px';
        heart.style.fontSize = '24px';
        heart.style.transition = 'all 1s ease-out';
        heart.style.opacity = '1';
        heart.style.zIndex = '1000';

        const randomX = (Math.random() - 0.5) * 50;
        heart.style.transform = `translateX(${randomX}px)`;

        document.body.appendChild(heart);

        setTimeout(() => {
            heart.style.transform = `translate(${randomX}px, -200px) scale(1.5)`;
            heart.style.opacity = '0';
        }, 50);

        setTimeout(() => {
            heart.remove();
        }, 1000);
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
        this.liveService.disconnect();
    }

    async sendComment() {
        if (!this.comment.trim()) return;

        const user = this.authService.getCurrentUser();
        if (!user) {
            this.showToast('You must be logged in to chat');
            return;
        }

        try {
            await this.supabaseService.sendLiveComment(
                this.streamerId,
                user.uid,
                this.comment,
                user.displayName || 'Anonymous',
                user.photoURL || 'https://i.pravatar.cc/30'
            );
            this.comment = '';
        } catch (error) {
            console.error('Error sending comment:', error);
            this.showToast('Failed to send comment');
        }
    }

    showGift3D(giftName: string) {
        this.activeGiftAnimation = giftName;
        // Play sound if needed
        setTimeout(() => {
            this.activeGiftAnimation = null;
        }, 3000); // 3 seconds duration
    }

    sendGift(gift: any) {
        const user = this.authService.getCurrentUser();
        // Optimistic 3D Local Show
        if (gift.name === 'Lion' || gift.name === 'Flower') {
            this.showGift3D(gift.name);
        }

        this.liveService.sendGift(
            this.streamerId,
            gift.name,
            gift.icon,
            user?.displayName || 'Anonymous',
            user?.photoURL || 'https://i.pravatar.cc/30',
            gift.coins
        );
        this.showToast(`${gift.icon} Gift sent!`);
    }

    async showToast(message: string) {
        const toast = await this.toastCtrl.create({
            message,
            duration: 2000,
            position: 'bottom'
        });
        toast.present();
    }

    close() {
        this.router.navigateByUrl('/home');
    }
}
