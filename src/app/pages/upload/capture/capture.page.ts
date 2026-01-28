import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  closeOutline, musicalNotes, repeat, flash, timerOutline,
  speedometerOutline, colorFilterOutline, chevronDownOutline,
  imagesOutline, sparkles, videocam, chevronBack, textOutline,
  happyOutline, add, flashOutline
} from 'ionicons/icons';
import { VideoService } from '../../../services/video';
import { LiveService } from '../../../services/live.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-capture',
  templateUrl: './capture.page.html',
  styleUrls: ['./capture.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class CapturePage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('viewfinder') viewfinder!: ElementRef<HTMLVideoElement>;
  selectedSound: any = null;
  audioPlayer: HTMLAudioElement | null = null;

  mediaStream: MediaStream | null = null;
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];
  isRecording = false;
  recordingTime = 0;
  timerInterval: any;

  // Multi-Mode State
  activeMode: '10s' | '60s' | '10m' | 'PHOTO' | 'TEXT' | 'LIVE' = '10s';
  showTextEditor = false;
  capturedText = '';

  // Advanced Tools State
  isFlashOn = false;
  currentFilter = 'none';
  selectedSpeed = 1; // 1x, 2x, 3x, 0.5x
  showFiltersMenu = false;
  showSpeedMenu = false;

  filters = [
    { name: 'none', label: 'Normal', css: '' },
    { name: 'vivid', label: 'Vivid', css: 'contrast(1.2) saturate(1.4)' },
    { name: 'vintage', label: 'Vintage', css: 'sepia(0.3) contrast(1.1) brightness(0.9)' },
    { name: 'grayscale', label: 'B&W', css: 'grayscale(1)' },
    { name: 'cinematic', label: 'Cinema', css: 'contrast(1.3) brightness(0.8) hue-rotate(-10deg)' }
  ];

  constructor(
    private router: Router,
    private videoService: VideoService,
    private toastCtrl: ToastController,
    private liveService: LiveService,
    private authService: AuthService
  ) {
    addIcons({
      closeOutline, musicalNotes, repeat, flash, timerOutline,
      speedometerOutline, colorFilterOutline, chevronDownOutline,
      imagesOutline, sparkles, videocam, chevronBack,
      textOutline, happyOutline, add, flashOutline
    });
  }

  async showToast(message: string, color: string = 'dark') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    toast.present();
  }

  ngOnInit() {
    this.videoService.selectedSound$.subscribe(sound => {
      this.selectedSound = sound;
    });
  }

  isGoingLive = false;

  ionViewWillEnter() {
    this.isGoingLive = false;
    this.initCamera();
  }

  ionViewWillLeave() {
    if (!this.isGoingLive) {
      this.stopCamera();
    }
    this.stopAudio();
  }

  async initCamera() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      if (this.viewfinder) {
        this.viewfinder.nativeElement.srcObject = this.mediaStream;
      }
    } catch (err) {
      console.error('Camera Access Denied:', err);
      this.showToast('Camera Permission Denied or Not Found 🚫🎥', 'danger');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  async toggleFlash() {
    if (!this.mediaStream) return;
    const track = this.mediaStream.getVideoTracks()[0];

    try {
      this.isFlashOn = !this.isFlashOn;
      // Torch constraint is device-dependent
      await (track as any).applyConstraints({
        advanced: [{ torch: this.isFlashOn }]
      });
      this.showToast(this.isFlashOn ? 'Flash ON 💡' : 'Flash OFF 🌑');
    } catch (err) {
      console.warn('Flash hardware not available on this device', err);
      this.showToast('Flash not supported on this device 🚫🔦', 'warning');
    }
  }

  toggleFilters() {
    this.showFiltersMenu = !this.showFiltersMenu;
    this.showSpeedMenu = false;
  }

  setFilter(filterName: string) {
    this.currentFilter = filterName;
    this.showFiltersMenu = false;
  }

  toggleSpeed() {
    this.showSpeedMenu = !this.showSpeedMenu;
    this.showFiltersMenu = false;
  }

  setSpeed(speed: number) {
    this.selectedSpeed = speed;
    this.showSpeedMenu = false;
    this.showToast(`Speed set to ${speed}x 🏎️`);
  }

  getFilterCSS(): string {
    const filter = this.filters.find(f => f.name === this.currentFilter);
    return filter ? filter.css : '';
  }

  setMode(mode: any) {
    if (this.isRecording) return;
    this.activeMode = mode;
    if (mode === 'TEXT') {
      this.openTextEditor();
    }
  }

  handleMainAction() {
    if (this.activeMode === 'PHOTO') {
      this.capturePhoto();
    } else if (this.activeMode === 'TEXT') {
      this.openTextEditor();
    } else {
      this.toggleRecording();
    }
  }

  capturePhoto() {
    if (!this.viewfinder) return;
    const video = this.viewfinder.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Bake the filter into the image
      if (this.currentFilter !== 'none') {
        ctx.filter = this.getFilterCSS();
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `toko-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          this.videoService.setPendingFile(file);
          this.goToPreview();
        }
      }, 'image/jpeg', 0.95);
    }
  }

  openTextEditor() {
    this.showTextEditor = true;
  }

  saveTextContent() {
    if (!this.capturedText.trim()) {
      this.showTextEditor = false;
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fe2c55';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 60px Inter, sans-serif';
      ctx.textAlign = 'center';

      const words = this.capturedText.split(' ');
      let line = '';
      let y = canvas.height / 2;
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        ctx.fillText(testLine, canvas.width / 2, y);
        y += 70;
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `toko-text-${Date.now()}.jpg`, { type: 'image/jpeg' });
          this.videoService.setPendingFile(file);
          this.showTextEditor = false;
          this.goToPreview();
        }
      });
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  startRecording() {
    if (!this.mediaStream || !this.viewfinder) return;

    // SETUP CINEMA CANVAS PIPELINE 🎨🎞️
    const video = this.viewfinder.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Stream generation from canvas (Bakes in filters!)
    const canvasStream = canvas.captureStream(30); // 30 FPS Cinema Standard

    // Add audio track from original stream
    const audioTrack = this.mediaStream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    this.recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    this.mediaRecorder = new MediaRecorder(canvasStream, { mimeType });

    // Start Animation Loop for Drawing
    const drawFrame = () => {
      if (!this.isRecording) return;

      // Apply Filter to Canvas
      ctx.filter = this.getFilterCSS();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      requestAnimationFrame(drawFrame);
    };

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordedChunks.push(event.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      // Inject speed metadata into filename for Preview logic
      const file = new File([blob], `toko-capture-${Date.now()}-speed-${this.selectedSpeed}.webm`, { type: 'video/webm' });
      this.videoService.setPendingFile(file);
      this.goToPreview();
    };

    this.mediaRecorder.start();
    this.isRecording = true;
    this.startAudio();
    requestAnimationFrame(drawFrame);
    this.startTimer();
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopAudio();
      this.stopTimer();
    }
  }

  startTimer() {
    this.recordingTime = 0;
    const max = this.activeMode === '10s' ? 10 : (this.activeMode === '60s' ? 60 : 600);
    this.timerInterval = setInterval(() => {
      this.recordingTime++;
      if (this.recordingTime >= max) this.stopRecording();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  startAudio() {
    if (this.selectedSound && this.selectedSound.url) {
      this.audioPlayer = new Audio(this.selectedSound.url);
      this.audioPlayer.play().catch(err => console.error('[SYNC-AUDIO] Playback failed:', err));
    }
  }

  stopAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer = null;
    }
  }

  close() {
    this.router.navigateByUrl('/home');
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.videoService.setPendingFile(file);
      this.goToPreview();
    }
  }

  goToPreview() {
    this.router.navigateByUrl('/preview');
  }

  async goLive() {
    // 1. Permission & Stream Check
    if (!this.mediaStream || !this.mediaStream.active) {
      console.log('[CAPTURE] Stream inactive, restarting...');
      await this.initCamera();
    }

    // 2. Double Check Tracks
    const videoTracks = this.mediaStream?.getVideoTracks();
    const audioTracks = this.mediaStream?.getAudioTracks();

    if (!videoTracks || videoTracks.length === 0 || !audioTracks || audioTracks.length === 0) {
      this.showToast('Camera and Microphone are both required! 🚫🎙️🎥', 'danger');
      return;
    }

    // 3. Auth Check
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showToast('Please login to go Live 🔐', 'warning');
      return;
    }

    try {
      this.showToast('Starting Broadcast... 🚀', 'dark');

      // 4. Start WebRTC & Signal
      await this.liveService.startBroadcast(
        user.uid,
        user.displayName || 'Broadcaster',
        user.photoURL || 'https://i.pravatar.cc/150?u=' + user.uid,
        this.mediaStream! // Non-null assertion safe due to checks above
      );

      this.showToast('You are now LIVE! 🔴', 'success');
      this.isGoingLive = true;
      this.router.navigate(['/live-broadcast']);

    } catch (error) {
      console.error('Failed to go live:', error);
      this.showToast('Failed to start broadcast. Try again.', 'danger');
    }
  }
}
