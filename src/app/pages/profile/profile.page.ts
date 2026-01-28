import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonContent, IonIcon, IonAvatar, IonModal, ToastController, NavController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  shareOutline, menuOutline, gridOutline, bookmarkOutline, lockClosedOutline,
  notificationsOutline, logoInstagram, logoTiktok, caretDown, search, add,
  playOutline, arrowBackOutline, linkOutline, sparklesOutline, repeatOutline,
  heartDislikeOutline, closeOutline, playSharp, videocamOutline, chevronBack,
  play, bagHandleOutline, chatbubbleOutline, personAddOutline, heartOutline,
  archiveOutline, sparkles, videocam, heart, chatbubble, bookmark,
  ellipsisHorizontal, flame, settings, chevronForward, logOutOutline, musicalNotes, shareSocial, repeat, logoTwitch, shareSocialOutline, starOutline
} from 'ionicons/icons';
import { register } from 'swiper/element/bundle';

register();
import { NavigationComponent } from '../../components/navigation/navigation.component';
import { LiveService } from '../../services/live.service';
import { VideoService } from '../../services/video';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { User } from 'firebase/auth';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonAvatar, IonModal, CommonModule, NavigationComponent, RouterModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProfilePage implements OnInit, OnDestroy {
  user: any = null;
  firebaseUser: User | null = null;
  posts: any[] = [];
  likedPosts: any[] = [];
  activeTab: 'posts' | 'liked' = 'posts';
  selectedVideo: any = null;
  isModalOpen = false;
  initialIndex = 0;
  modalVideos: any[] = [];
  profileId: string | null = null;
  isLive = false;
  private userSub: Subscription | null = null;
  private liveSub: Subscription | null = null;

  formatCount(count: any): string {
    if (!count) return '0';
    const num = parseInt(count.toString().replace(/[^0-9]/g, ''));
    if (isNaN(num)) return count; // Handle strings like '1.1M'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  constructor(
    private videoService: VideoService,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private liveService: LiveService
  ) {
    addIcons({ arrowBackOutline, personAddOutline, shareOutline, logOutOutline, add, sparkles, gridOutline, heartOutline, lockClosedOutline, bookmarkOutline, playOutline, notifications: notificationsOutline, shareSocialOutline: shareSocial, starOutline: sparkles, chevronBack, videocam, heart, archiveOutline, closeOutline, search, chatbubble, bookmark, ellipsisHorizontal, musicalNotes, menuOutline, flame, chevronForward, playSharp, logoTwitch, logoInstagram, logoTiktok, caretDown, sparklesOutline, repeatOutline, heartDislikeOutline, play, videocamOutline, linkOutline, bagHandleOutline, chatbubbleOutline, settings, repeat });
  }
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.profileId = params['id'];
      console.log('[PROFILE] Loading profile for ID:', this.profileId || 'self');
      this.loadProfile(this.profileId);
    });

    this.userSub = this.authService.user$.subscribe(user => {
      this.firebaseUser = user;
    });

    this.liveSub = this.liveService.isBroadcasting$.subscribe(isLive => {
      this.isLive = isLive;
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    if (this.liveSub) {
      this.liveSub.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.loadProfile();
  }

  loadProfile(uid?: string | null) {
    const targetUid = uid || this.profileId;
    this.videoService.getProfile(targetUid || undefined).subscribe({
      next: (data) => {
        this.user = data;
        this.posts = data.posts;
        const currentFirebaseUser = this.authService.getCurrentUser();
        if (currentFirebaseUser) {
          const userIdForLikes = targetUid || currentFirebaseUser.uid;
          this.loadLikedVideos(userIdForLikes);
        }
      },
      error: (err) => console.error('Error loading profile', err)
    });
  }

  isOwnProfile(): boolean {
    const currentUid = this.authService.getCurrentUser()?.uid;
    if (!currentUid || !this.user) return false;
    if (!this.profileId) return true;
    return currentUid === this.profileId || currentUid === this.user.userId;
  }

  toggleFollow() {
    if (!this.user || this.isOwnProfile()) return;

    this.user.isFollowing = !this.user.isFollowing;
    if (this.user.isFollowing) {
      this.user.followers++;
    } else {
      this.user.followers--;
    }

    this.videoService.followUser(this.user.userId).subscribe({
      error: () => {
        this.user.isFollowing = !this.user.isFollowing;
        if (this.user.isFollowing) this.user.followers++;
        else this.user.followers--;
      }
    });
  }

  loadLikedVideos(uid?: string) {
    const userId = uid || this.authService.getCurrentUser()?.uid;
    if (!userId) return;

    this.videoService.getLikedVideos(userId).subscribe({
      next: (data) => {
        this.likedPosts = data;
      },
      error: (err) => console.error('Error loading liked videos', err)
    });
  }

  setTab(tab: 'posts' | 'liked') {
    this.activeTab = tab;
    if (tab === 'liked') {
      this.loadLikedVideos();
    }
  }

  async logout() {
    try {
      await this.authService.logout();
      const toast = await this.toastCtrl.create({
        message: 'Logged out successfully! 👋',
        duration: 2000,
        position: 'top',
        color: 'success'
      });
      toast.present();
      this.router.navigateByUrl('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async playVideo(index: number) {
    this.modalVideos = this.activeTab === 'posts' ? this.posts : this.likedPosts;
    this.initialIndex = index;
    this.selectedVideo = this.modalVideos[index];
    this.isModalOpen = true;
  }

  closePlayer() {
    this.isModalOpen = false;
    this.selectedVideo = null;
  }
  goLive() {
    this.router.navigate(['/live-broadcast']);
  }
}
