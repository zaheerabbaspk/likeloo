import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewChildren, QueryList, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon, ToastController, IonModal, IonHeader, IonToolbar, IonTitle, IonImg, IonText } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { searchOutline, notificationsOutline, home, compassOutline, add, chatbubbleOutline, personOutline, heart, chatbubble, shareSocial, musicalNotes, bookmark, ellipsisHorizontal, playOutline, chevronForward, chevronBack, play, peopleOutline, happyOutline, atOutline, heartOutline, close, helpCircleOutline, logoWhatsapp, logoFacebook, logoInstagram, logoTwitter, paperPlaneOutline, flagOutline, downloadOutline, linkOutline, textOutline, cutOutline, checkmarkCircle, chatbubbleEllipsesOutline, closeCircle, trashOutline, tvOutline } from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { VideoService } from '../services/video';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { NavigationComponent } from '../components/navigation/navigation.component';
import { AlertController } from '@ionic/angular/standalone';

register();

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, NavigationComponent, RouterModule, IonModal, IonHeader, IonToolbar, IonTitle, IonImg, IonText, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('videoPlayer') videoPlayers!: QueryList<ElementRef<HTMLVideoElement>>;

  private intersectionObserver!: IntersectionObserver;
  private mutationObserver!: MutationObserver;

  formatCount(count: any): string {
    if (!count) return '0';
    const num = parseInt(count);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  videos: any[] = [];
  activeIndex = 0;
  currentFeed: 'following' | 'foryou' = 'foryou';
  showHeart = false;
  heartPosition = { x: 0, y: 0 };
  lastTap = 0;
  showUI = true;
  // State
  showProfile = false;
  selectedCreator: any = null;
  isPlaying = true;
  uploadProgress$ = this.videoService.uploadProgress$;
  currentComment = '';
  activeVideoId = '';
  isLiking = false; // Prevent spamming
  replyToComment: any = null; // Track if we are replying to a specific comment
  sharingVideo: any = null;
  currentUserUid: string | null = null;
  activeLiveSessions: any[] = [];

  // Comments State
  isCommentsOpen = false;
  comments: any[] = [
    {
      id: 1,
      userName: 'doctorwu',
      userPhoto: 'https://i.pravatar.cc/150?u=doc',
      text: "What's your favorite type of pasta?",
      createdAt: Date.now() - 3600000,
      likes: 9721,
      isAskedBy: true,
      likedByViewer: false
    }
  ];

  async openComments(event: Event, video: any) {
    event.stopPropagation();
    this.activeVideoId = video.id;
    this.isCommentsOpen = true;
    this.loadComments(video.id);
  }

  loadComments(videoId: string) {
    this.videoService.getComments(videoId).subscribe({
      next: (data) => this.comments = data,
      error: () => console.error('Failed to load comments')
    });
  }

  submitComment() {
    if (!this.currentComment.trim() || !this.activeVideoId) return;

    if (this.replyToComment) {
      this.videoService.addReply(this.activeVideoId, this.replyToComment.id, this.currentComment).subscribe({
        next: () => {
          this.loadComments(this.activeVideoId);
          this.currentComment = '';
          this.replyToComment = null;
        }
      });
    } else {
      this.videoService.addComment(this.activeVideoId, this.currentComment).subscribe({
        next: () => {
          this.loadComments(this.activeVideoId);
          this.currentComment = '';
          const video = this.videos.find(v => v.id === this.activeVideoId);
          if (video) video.comments = (parseInt(video.comments) || 0) + 1;
        }
      });
    }
  }

  toggleCommentLike(comment: any) {
    if (!this.activeVideoId) return;

    // Optimistic UI
    comment.isLiked = !comment.isLiked;
    comment.likes = comment.isLiked ? (comment.likes || 0) + 1 : (comment.likes || 1) - 1;

    this.videoService.likeComment(this.activeVideoId, comment.id).subscribe({
      next: (res: any) => {
        comment.isLiked = res.isLiked;
        comment.likes = res.likes;
      },
      error: () => {
        // Revert
        comment.isLiked = !comment.isLiked;
        comment.likes = comment.isLiked ? (comment.likes || 0) + 1 : (comment.likes || 1) - 1;
      }
    });
  }

  setReplyTo(comment: any) {
    this.replyToComment = comment;
    this.currentComment = `@${comment.userName} `;
  }

  cancelReply() {
    this.replyToComment = null;
    this.currentComment = '';
  }

  closeComments() {
    this.isCommentsOpen = false;
  }

  openSoundPage(event: Event, video: any) {
    event.stopPropagation();
    console.log('[SOUND] Navigating to sound page for:', video.soundId || video.id);
    this.router.navigateByUrl(`/sound/${video.soundId || video.id}`);
  }


  // Share State
  isShareOpen = false;

  openShare(event: Event, video: any) {
    event.stopPropagation();
    this.sharingVideo = video;
    this.isShareOpen = true;
  }

  closeShare() {
    this.isShareOpen = false;
    this.sharingVideo = null;
  }

  async deleteVideoAction() {
    if (!this.sharingVideo) return;
    this.isShareOpen = false;

    const alert = await this.alertCtrl.create({
      header: 'Delete Video?',
      message: 'Are you sure you want to delete this video? This action cannot be undone.',
      cssClass: 'custom-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.videoService.deleteVideo(this.sharingVideo.id).subscribe({
              next: async () => {
                const toast = await this.toastCtrl.create({
                  message: 'Video deleted successfully',
                  duration: 2000,
                  position: 'top'
                });
                toast.present();
                this.loadFeed(); // Refresh feed
              },
              error: async () => {
                const toast = await this.toastCtrl.create({
                  message: 'Failed to delete video',
                  duration: 2000,
                  position: 'top'
                });
                toast.present();
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  async shareAction(action: string) {
    if (action === 'delete') {
      this.deleteVideoAction();
      return;
    }
    this.isShareOpen = false;
    let message = '';

    switch (action) {
      case 'copy':
        // Modern Clipboard API
        await navigator.clipboard.writeText(window.location.href);
        message = 'Link copied to clipboard! 📋';
        break;
      case 'save':
        message = 'Saving video... ⬇️';
        // Simulate download for now
        break;
      case 'report':
        message = 'Thanks for reporting.';
        break;
      case 'use-sound':
        this.videoService.setSelectedSound({
          id: this.sharingVideo.soundId || this.sharingVideo.id,
          title: this.sharingVideo.soundName || `Original sound - ${this.sharingVideo.userName}`,
          userName: this.sharingVideo.userName,
          url: this.sharingVideo.videoUrl
        });
        this.router.navigateByUrl('/capture');
        return; // Don't show toast, we are navigating
      default:
        message = `Shared to ${action}`;
    }

    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'top',
      cssClass: 'custom-toast' // We can style this later
    });
    toast.present();
  }

  constructor(
    private videoService: VideoService,
    private toastCtrl: ToastController,
    private el: ElementRef,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    addIcons({ tvOutline, searchOutline, play, heart, add, checkmarkCircle, chatbubble, bookmark, shareSocial, musicalNotes, chatbubbleOutline, close, chatbubbleEllipsesOutline, closeCircle, paperPlaneOutline, logoWhatsapp, logoFacebook, logoInstagram, logoTwitter, flagOutline, downloadOutline, trashOutline, linkOutline, textOutline, cutOutline, helpCircleOutline, atOutline, happyOutline, notificationsOutline, home, compassOutline, personOutline, ellipsisHorizontal, playOutline, chevronForward, chevronBack, peopleOutline, heartOutline });
  }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUserUid = user?.uid || null;
    });

    this.videoService.activeFeed$.subscribe(feed => {
      if (this.currentFeed !== feed) {
        this.switchFeed(feed);
      }
    });
    this.loadFeed();
  }

  ngAfterViewInit() {
    this.initCinemaEngine();
    this.setupViewTracker();

    this.videoPlayers.changes.subscribe(() => {
      this.rebindCinemaEngine();
      this.playActiveVideo();
    });
  }

  ngOnDestroy() {
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    if (this.mutationObserver) this.mutationObserver.disconnect();
  }

  ionViewWillEnter() {
    this.loadFeed(); // Production: Ensure fresh data after upload
    this.rebindCinemaEngine();
    this.playActiveVideo();
  }

  ionViewWillLeave() {
    this.pauseAll();
  }

  /**
   * CINEMA ENGINE: CORE INITIALIZATION
   */
  private initCinemaEngine() {
    console.log('Cinema Engine: Initializing reliability observers...');

    // 1. INTERSECTION OBSERVER (60% Visibility Rule)
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          console.log('Cinema Engine: Video ≥60% visible. Auto-playing...');
          video.play().catch(e => console.warn('Cinema Engine: Play blocked by browser', e));
          this.isPlaying = true;
        } else {
          video.pause();
        }
      });
    }, { threshold: [0.6] });

    // 2. MUTATION OBSERVER (DOM Tracking)
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            const videos = node.querySelectorAll('video');
            videos.forEach(v => this.intersectionObserver.observe(v));
          }
        });
      });
    });

    this.mutationObserver.observe(this.el.nativeElement, { childList: true, subtree: true });
  }

  private rebindCinemaEngine() {
    if (!this.videoPlayers) return;
    console.log('Cinema Engine: Re-binding observers to', this.videoPlayers.length, 'videos');
    this.videoPlayers.forEach(player => {
      const video = player.nativeElement;
      this.intersectionObserver.unobserve(video);
      this.intersectionObserver.observe(video);
    });
  }

  switchFeed(feed: 'following' | 'foryou') {
    if (this.currentFeed === feed) return;
    this.currentFeed = feed;
    this.videos = []; // Clear for smooth transition
    if (feed === 'foryou') {
      this.loadFeed();
    } else {
      this.loadFollowing();
    }
  }

  loadFeed() {
    this.videoService.getFeed().subscribe({
      next: (data) => {
        this.videos = data;
        this.activeIndex = 0;
        console.log('For You (AUTOPLAY READY):', data.length);
        // Force engine kick after render
        setTimeout(() => this.playActiveVideo(), 500);
      },
      error: (err) => this.handleError(err)
    });

    // Initial Load
    this.loadLiveSessions();

    // Real-time Subscription
    this.supabaseService.subscribeToActiveSessions().subscribe((payload) => {
      console.log('[HOME] Live Session Update:', payload);
      this.handleLiveSessionUpdate(payload);
    });
  }

  handleLiveSessionUpdate(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // Add new session if status is live
      if (newRecord.status === 'live') {
        // Avoid duplicates
        if (!this.activeLiveSessions.find(s => s.id === newRecord.id)) {
          this.activeLiveSessions.unshift(newRecord);
        }
      }
    } else if (eventType === 'UPDATE') {
      if (newRecord.status === 'ended') {
        // Remove ended session
        this.activeLiveSessions = this.activeLiveSessions.filter(s => s.id !== newRecord.id);
      } else {
        // Update existing
        const index = this.activeLiveSessions.findIndex(s => s.id === newRecord.id);
        if (index !== -1) {
          this.activeLiveSessions[index] = newRecord;
        } else if (newRecord.status === 'live') {
          this.activeLiveSessions.unshift(newRecord);
        }
      }
    } else if (eventType === 'DELETE') {
      this.activeLiveSessions = this.activeLiveSessions.filter(s => s.id !== oldRecord.id);
    }
  }

  async loadLiveSessions() {
    try {
      const { data, error } = await this.supabaseService.getActiveSessions();
      if (data) {
        this.activeLiveSessions = data;
      }
    } catch (e) {
      console.error('Failed to load live sessions', e);
    }
  }

  loadFollowing() {
    this.videoService.getFollowing().subscribe({
      next: (data) => {
        this.videos = data;
        this.activeIndex = 0;
        console.log('Following (AUTOPLAY READY):', data.length);
        setTimeout(() => this.playActiveVideo(), 500);
      },
      error: (err) => this.handleError(err)
    });
  }

  handleError(err: any) {
    console.error('Playback Context Error:', err);
    this.videos = [
      {
        id: "retry-1",
        url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        creator: '@toko_system',
        description: 'Syncing feed... please swipe down to refresh. #toko',
        likes: '0',
        comments: '0',
        shares: '0',
        music: 'System Sync'
      }
    ];
    setTimeout(() => this.playActiveVideo(), 500);
  }

  onSlideChange(event: any) {
    const swiper = event.detail[0];
    this.activeIndex = swiper.activeIndex;
    this.isPlaying = true; // TikTok style: Auto play on scroll
    this.playActiveVideo();
  }

  playActiveVideo() {
    if (!this.videoPlayers || this.videoPlayers.length === 0) return;

    console.log('Cinema Engine: Syncing playback state for index', this.activeIndex);
    const players = this.videoPlayers.toArray();

    // 1. Force state isolation
    players.forEach((p, i) => {
      const v = p.nativeElement;
      if (i !== this.activeIndex) {
        v.pause();
        v.currentTime = 0;
      }
    });

    // 2. High-priority playback trigger
    const activeVideo = players[this.activeIndex]?.nativeElement;
    if (activeVideo) {
      activeVideo.muted = true;
      activeVideo.load(); // Flush previous state

      const playPromise = activeVideo.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('Cinema Engine: Playback confirmed moving');
          this.isPlaying = true;
        }).catch(err => {
          console.warn('Cinema Engine: Autoplay blocked by browser policy', err);
          this.isPlaying = false; // Show massive play button
        });
      }
    }
  }

  pauseAll() {
    if (this.videoPlayers) {
      this.videoPlayers.forEach(p => p.nativeElement.pause());
    }
  }

  debugPlay(event: MouseEvent) {
    console.log('Production: Manual tap detected on video element');
    const video = event.target as HTMLVideoElement;
    video.muted = true;
    video.play()
      .then(() => console.log('Production: Manual playback SUCCESS'))
      .catch(err => console.error('Production: Manual playback BLOCKED', err));
  }

  handleTap(event: any, videoId: string) {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - this.lastTap < DOUBLE_TAP_DELAY) {
      this.onDoubleTap(event, videoId);
    } else {
      // Toggle play/pause on single tap (TikTok style)
      setTimeout(() => {
        if (Date.now() - this.lastTap >= DOUBLE_TAP_DELAY) {
          this.togglePlayback();
        }
      }, DOUBLE_TAP_DELAY);
    }
    this.lastTap = now;
  }

  togglePlayback() {
    if (!this.videoPlayers) return;
    const activePlayer = this.videoPlayers.toArray()[this.activeIndex]?.nativeElement;
    if (!activePlayer) return;

    if (activePlayer.paused) {
      activePlayer.play();
      this.isPlaying = true;
    } else {
      activePlayer.pause();
      this.isPlaying = false;
    }
  }

  async onVideoError(event: any, videoId: string) {
    console.error('Cinema Engine Error:', videoId, event);
  }

  openProfile(event: Event, video: any) {
    event.stopPropagation();
    this.selectedCreator = video;
    this.showProfile = true;
    this.pauseAll();
  }

  closeProfile() {
    this.showProfile = false;
    this.playActiveVideo();
  }

  onDoubleTap(event: any, videoId: string) {
    this.heartPosition = { x: event.clientX || (event.touches ? event.touches[0].clientX : 0), y: event.clientY || (event.touches ? event.touches[0].clientY : 0) };
    this.showHeart = true;

    const video = this.videos.find(v => v.id === videoId);
    if (video && !video.isLiked) {
      this.handleLike(video, event);
    }

    setTimeout(() => this.showHeart = false, 800);
  }

  handleLike(video: any, event: Event) {
    if (event) event.stopPropagation();
    if (video.isLiked || this.isLiking) return;

    console.log('[HOME] Liking video:', video.id);
    this.isLiking = true;

    // Optimistic UI Update
    video.isLiked = true;
    video.likes = (parseInt(video.likes) || 0) + 1;

    this.videoService.likeVideo(video.id).subscribe({
      next: () => {
        this.isLiking = false;
        console.log('[HOME] Like persisted');
      },
      error: (err) => {
        this.isLiking = false;
        video.isLiked = false;
        video.likes--;
        console.error('[HOME] Like failed:', err);
      }
    });

    // Heart Animation (Positioned at tap or center)
    if (event.type === 'click') {
      const mouseEvent = event as MouseEvent;
      this.heartPosition = {
        x: mouseEvent.clientX || window.innerWidth / 2,
        y: mouseEvent.clientY || window.innerHeight / 2
      };
      this.showHeart = true;
      setTimeout(() => this.showHeart = false, 800);
    }
  }

  followUser(userId: string, event: Event) {
    event.stopPropagation();
    console.log('[HOME] Following user:', userId);
    this.videoService.followUser(userId).subscribe({
      next: () => {
        // Update local state to show 'Following'
        this.videos.forEach(v => {
          if (v.userId === userId) v.isFollowed = true;
        });
      }
    });
  }



  private setupViewTracker() {
    const options = {
      threshold: 0.6 // Video must be 60% visible
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const videoId = (entry.target as HTMLElement).getAttribute('data-id');
          if (videoId) {
            setTimeout(() => {
              if (entry.isIntersecting) {
                console.log('[VIEW-TRACKER] View recorded for:', videoId);
                this.videoService.trackView(videoId).subscribe();
              }
            }, 600);
          }
        }
      });
    }, options);

    // Initial Observation
    setTimeout(() => {
      document.querySelectorAll('.video-container').forEach(el => observer.observe(el));
    }, 3000);
  }

  joinLiveStream(streamId: string) {
    this.router.navigate(['/live', streamId]);
  }
}
