import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, musicalNotes, colorFilterOutline, textOutline, happyOutline, speedometerOutline, chevronDownOutline, sparkles, arrowBack } from 'ionicons/icons';
import { VideoService } from '../../../services/video';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.page.html',
  styleUrls: ['./preview.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule]
})
export class PreviewPage implements OnInit {
  videoUrl: string | null = null;
  playbackSpeed = 1;
  selectedSound: any = null;
  audioPlayer: HTMLAudioElement | null = null;

  constructor(private router: Router, private videoService: VideoService) {
    addIcons({
      chevronBack, musicalNotes, colorFilterOutline,
      textOutline, happyOutline,
      speedometerOutline, chevronDownOutline, sparkles, arrowBack
    });
  }

  ngOnInit() {
    this.videoUrl = this.videoService.getPendingPreviewUrl();
    const file = this.videoService.getPendingFile();

    if (file && file.name.includes('-speed-')) {
      const speedStr = file.name.split('-speed-')[1].split('.').shift();
      this.playbackSpeed = parseFloat(speedStr || '1');
    }

    if (!this.videoUrl) {
      console.warn('No pending video found, redirecting...');
      this.router.navigateByUrl('/capture');
    }

    this.videoService.selectedSound$.subscribe(sound => {
      this.selectedSound = sound;
    });
  }

  ionViewDidEnter() {
    const player = document.querySelector('video');
    if (player) {
      player.playbackRate = this.playbackSpeed;
      if (this.selectedSound) {
        player.muted = true;
        this.playAudio();
      }
    }
  }

  ionViewWillLeave() {
    this.stopAudio();
  }

  playAudio() {
    if (this.selectedSound && this.selectedSound.url) {
      this.audioPlayer = new Audio(this.selectedSound.url);
      this.audioPlayer.play().catch(err => console.error('[PREVIEW-AUDIO] Playback failed:', err));
    }
  }

  stopAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer = null;
    }
  }

  goBack() {
    this.router.navigateByUrl('/capture');
  }

  goToPost() {
    this.router.navigateByUrl('/post');
  }
}
