import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, ToastController, LoadingController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { home, searchOutline, add, chatbubbleOutline, personOutline, compassOutline, peopleOutline } from 'ionicons/icons';
import { VideoService } from '../../services/video';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss'],
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IonIcon, CommonModule]
})
export class NavigationComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  isDarkMode = true;

  constructor(
    private videoService: VideoService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router
  ) {
    addIcons({ home, peopleOutline, add, chatbubbleOutline, personOutline, searchOutline, compassOutline });

    // Theme Detection Logic
    this.router.events.subscribe(() => {
      const url = this.router.url;
      // Home Feed = Dark, Everything else = Light (as per user request for Profile)
      this.isDarkMode = url.includes('/home') || url === '/';
    });
  }

  ngOnInit() {
    const url = this.router.url;
    this.isDarkMode = url.includes('/home') || url === '/';
  }

  goToFriends() {
    this.videoService.setActiveFeed('following');
    this.router.navigateByUrl('/home');
  }

  triggerUpload() {
    this.videoService.setSelectedSound(null);
    this.router.navigateByUrl('/capture');
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const loading = await this.loadingCtrl.create({
      message: 'Uploading clip...',
      spinner: 'crescent'
    });
    await loading.present();

    this.videoService.uploadVideoUnified('Amazing new clip! #toko', file).subscribe({
      next: async (res) => {
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: 'Video posted! Check your profile.',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        // Auto navigate to profile to show the new video
        this.router.navigateByUrl('/profile');
      },
      error: async (err) => {
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: 'Upload failed. Try again.',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }
}
