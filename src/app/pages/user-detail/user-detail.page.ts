import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, NavController, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBack, notificationsOutline, shareSocialOutline, linkOutline,
  starOutline, menuOutline, logoTwitch, repeatOutline, bookmarkOutline,
  playOutline, caretDown, shareSocial, sparkles, searchOutline, heart, chatbubble, musicalNotes, bookmark
} from 'ionicons/icons';
import { ActivatedRoute, Router } from '@angular/router';
import { VideoService } from '../../services/video';
import { AuthService } from '../../services/auth.service';
import { NavigationComponent } from '../../components/navigation/navigation.component';

@Component({
  selector: 'app-user-detail',
  templateUrl: './user-detail.page.html',
  styleUrls: ['./user-detail.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonIcon, IonModal, NavigationComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class UserDetailPage implements OnInit {
  userId: string | null = null;
  user: any = null;
  posts: any[] = [];
  activeTab: 'posts' | 'liked' = 'posts';
  isModalOpen = false;
  selectedVideo: any = null;
  isPlaying = true;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private authService: AuthService,
    private navCtrl: NavController,
    private router: Router
  ) {
    addIcons({
      chevronBack, notificationsOutline, shareSocialOutline: shareSocial,
      linkOutline, starOutline: sparkles, menuOutline, logoTwitch: playOutline,
      repeatOutline, bookmarkOutline, playOutline, caretDown, shareSocial, sparkles,
      chatbubble, bookmark, searchOutline, musicalNotes, heart
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.userId = params.get('id');
      if (this.userId) {
        this.loadProfile(this.userId);
      }
    });
  }

  loadProfile(uid: string) {
    const currentUserId = this.authService.getCurrentUser()?.uid;
    // Check if it's actually our own profile, if so redirect or just show detail
    if (currentUserId === uid) {
      // Optional: Redirect to main profile? For now let's just show it in discovery mode if they want
    }

    this.videoService.getProfile(uid).subscribe({
      next: (data) => {
        this.user = data;
        this.posts = data.posts;
      },
      error: (err) => console.error('Error loading user detail', err)
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  setTab(tab: any) {
    this.activeTab = tab;
  }

  toggleFollow() {
    if (!this.user) return;
    this.user.isFollowing = !this.user.isFollowing;
    if (this.user.isFollowing) this.user.followers++;
    else this.user.followers--;

    this.videoService.followUser(this.userId!).subscribe({
      error: () => {
        this.user.isFollowing = !this.user.isFollowing;
        if (this.user.isFollowing) this.user.followers++;
        else this.user.followers--;
      }
    });
  }

  openChat() {
    if (!this.userId) return;
    this.router.navigate(['/chat', this.userId]);
  }

  shareProfile() {
    // Mock share
    console.log('Sharing profile:', this.user?.username);
  }

  playVideo(index: number) {
    this.selectedVideo = this.posts[index];
    this.isModalOpen = true;
  }

  closePlayer() {
    this.isModalOpen = false;
    this.selectedVideo = null;
  }

  togglePlay(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video.paused) {
      video.play();
      this.isPlaying = true;
    } else {
      video.pause();
      this.isPlaying = false;
    }
  }

  formatCount(count: any): string {
    if (!count) return '0';
    const num = parseInt(count.toString().replace(/[^0-9]/g, ''));
    if (isNaN(num)) return count;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
