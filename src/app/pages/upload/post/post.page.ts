import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, locationOutline, addOutline, earthOutline, settingsOutline, archiveOutline, cloudUploadOutline, chevronForward } from 'ionicons/icons';
import { VideoService } from '../../../services/video';

@Component({
  selector: 'app-post',
  templateUrl: './post.page.html',
  styleUrls: ['./post.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class PostPage implements OnInit {
  description: string = '';
  videoUrl: string | null = null;

  constructor(
    private router: Router,
    private videoService: VideoService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      chevronBack, locationOutline, addOutline,
      earthOutline, settingsOutline, archiveOutline,
      cloudUploadOutline, chevronForward
    });
  }

  ngOnInit() {
    this.videoUrl = this.videoService.getPendingPreviewUrl();
  }

  goBack() {
    this.router.navigateByUrl('/preview');
  }

  async post() {
    console.log('Final Post triggered with real binary data...');
    const file = this.videoService.getPendingFile();

    if (!file) {
      const toast = await this.toastCtrl.create({
        message: 'No video selected. Upload from gallery!',
        duration: 2000,
        color: 'warning'
      });
      toast.present();
      return;
    }

    this.videoService.uploadVideoUnified(this.description || 'Amazing new Toko clip! #original', file).subscribe({
      next: async () => {
        this.videoService.setActiveFeed('following');
        this.videoService.setPendingFile(null); // This clears file AND revokes Blob URL 🛡️⚡
        this.videoService.setSelectedSound(null); // Clear sound after post 🚀

        const toast = await this.toastCtrl.create({
          message: 'Post shared successfully! 🚀',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        toast.present();
        this.router.navigateByUrl('/home');
      },
      error: async (err) => {
        console.error('Upload Failed:', err);
        const toast = await this.toastCtrl.create({
          message: 'Upload failed. Please try again.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
      }
    });
  }
}
