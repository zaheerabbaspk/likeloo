import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { IonContent, IonIcon, ToastController, AlertController, IonModal, IonButton, IonAvatar, IonList, IonItem, IonLabel } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { closeOutline, chatbubble, people, gift, send, settings, flash } from 'ionicons/icons';
import { LiveService } from '../../services/live.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-live-broadcast',
    templateUrl: './live-broadcast.page.html',
    styleUrls: ['./live-broadcast.page.scss'],
    standalone: true,
    imports: [IonContent, IonIcon, CommonModule, FormsModule, IonModal, IonButton, IonAvatar, IonList, IonItem, IonLabel]
})
export class LiveBroadcastPage implements OnInit, OnDestroy {
    @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('pkVideo') pkVideoRef!: ElementRef<HTMLVideoElement>;

    viewerCount = 0;
    comments: { senderName: string, message: string, senderAvatar: string }[] = [];
    gifts: { giftName: string, giftIcon: string, senderName: string, coins: number }[] = [];
    isLive = false;
    elapsedTime = 0;
    timerInterval: any;

    // PK State
    isPkMode = false;
    isPkModalOpen = false;
    activeStreamers: any[] = [];
    incomingPkRequest: { streamerId: string, streamerName: string } | null = null;

    private subscriptions: Subscription[] = [];

    constructor(
        private router: Router,
        private liveService: LiveService,
        private authService: AuthService,
        private toastCtrl: ToastController,
        private supabaseService: SupabaseService,
        private alertCtrl: AlertController
    ) {
        addIcons({ closeOutline, chatbubble, people, gift, send, settings, flash });
    }

    ngOnInit() {
        this.isLive = true;
        this.startTimer();

        // Subscribe to viewer count
        this.subscriptions.push(
            this.liveService.viewerCount$.subscribe(count => {
                this.viewerCount = count;
            })
        );

        // Subscribe to chat messages
        this.subscriptions.push(
            this.liveService.chatMessages$.subscribe(msg => {
                this.comments.unshift(msg);
                if (this.comments.length > 50) this.comments.pop();
            })
        );

        // Subscribe to gifts
        this.subscriptions.push(
            this.liveService.giftsReceived$.subscribe(gift => {
                this.gifts.unshift(gift);
                this.showGiftAnimation(gift);
                if (this.gifts.length > 20) this.gifts.pop();
            })
        );

        // PK: Incoming Request
        this.subscriptions.push(
            this.liveService.pkRequest$.subscribe(async (req) => {
                this.incomingPkRequest = req;
                await this.showPkRequestAlert(req);
            })
        );

        // PK: Mode Activation
        this.subscriptions.push(
            this.liveService.isPkMode$.subscribe(isActive => {
                this.isPkMode = isActive;
            })
        );

        // PK: Remote Stream
        this.subscriptions.push(
            this.liveService.pkStream$.subscribe(stream => {
                if (stream && this.pkVideoRef) {
                    this.pkVideoRef.nativeElement.srcObject = stream;
                    // Ensure playback
                    this.pkVideoRef.nativeElement.play().catch(e => console.error('PK Play error', e));
                }
            })
        );
    }

    // ... (rest of methods)

    async openPkModal() {
        this.isPkModalOpen = true;
        const { data } = await this.supabaseService.getActiveSessions();
        // Filter out myself
        this.authService.user$.subscribe(user => {
            if (user && data) {
                this.activeStreamers = data.filter((s: any) => s.host_id !== user.uid);
            }
        });
    }

    closePkModal() {
        this.isPkModalOpen = false;
    }

    sendPkInvite(streamer: any) {
        this.liveService.requestPK(streamer.stream_id, streamer.host_name || 'Broadcaster');
        this.closePkModal();
        this.showToast('PK Invitation Sent! ⚔️');
    }

    async showPkRequestAlert(req: { streamerId: string, streamerName: string }) {
        const alert = await this.alertCtrl.create({
            header: 'PK Challenge! ⚔️',
            message: `${req.streamerName} wants to battle you!`,
            buttons: [
                {
                    text: 'Reject',
                    role: 'cancel',
                    handler: () => {
                        // TODO: Send reject
                        this.incomingPkRequest = null;
                    }
                },
                {
                    text: 'Accept',
                    handler: () => {
                        this.liveService.acceptPK(req.streamerId);
                        this.incomingPkRequest = null;
                    }
                }
            ]
        });
        await alert.present();
    }

    async showToast(msg: string) {
        const toast = await this.toastCtrl.create({
            message: msg,
            duration: 2000,
            position: 'top'
        });
        toast.present();
    }

    // ... (existing helper methods)


    ionViewDidEnter() {
        // Display local stream on video element
        const localStream = (this.liveService as any).localStream;
        if (localStream && this.localVideoRef) {
            this.localVideoRef.nativeElement.srcObject = localStream;
        }
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
        clearInterval(this.timerInterval);
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.elapsedTime++;
        }, 1000);
    }

    formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    showGiftAnimation(gift: any) {
        // TODO: Implement floating gift animation
        console.log('Gift received:', gift);
    }

    async endLive() {
        this.liveService.endBroadcast();
        this.isLive = false;
        clearInterval(this.timerInterval);

        const toast = await this.toastCtrl.create({
            message: 'Live stream ended 🔴',
            duration: 2000,
            color: 'dark'
        });
        toast.present();

        this.router.navigateByUrl('/home');
    }
}
