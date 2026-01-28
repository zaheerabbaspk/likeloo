import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonHeader, IonToolbar, IonButtons, IonBackButton, IonInput } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, shareSocialOutline, searchOutline, bookmarkOutline, ellipsisHorizontal, playOutline, videocamOutline, musicalNotes, pencilOutline, chevronForward, add } from 'ionicons/icons';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { VideoService } from '../../services/video';

@Component({
    selector: 'app-sound',
    templateUrl: './sound.page.html',
    styleUrls: ['./sound.page.scss'],
    standalone: true,
    imports: [IonContent, IonIcon, IonHeader, IonToolbar, IonButtons, IonBackButton, IonInput, CommonModule, FormsModule, RouterModule]
})
export class SoundPage implements OnInit {
    soundId: string = '';
    soundData: any = {
        title: 'Original Sound',
        userName: 'creator',
        userPhoto: 'https://i.pravatar.cc/300?u=sound',
        postCount: 0
    };
    videos: any[] = [];

    constructor(
        private route: ActivatedRoute,
        private videoService: VideoService,
        private router: Router
    ) {
        addIcons({
            arrowBackOutline, shareSocialOutline, searchOutline,
            bookmarkOutline, ellipsisHorizontal, playOutline,
            videocamOutline, musicalNotes, pencilOutline, chevronForward, add
        });
    }

    ngOnInit() {
        this.soundId = this.route.snapshot.paramMap.get('id') || '';
        if (this.soundId) {
            this.loadSoundData();
        }
    }

    loadSoundData() {
        this.videoService.getVideosBySound(this.soundId).subscribe({
            next: (data) => {
                this.videos = data;
                if (data.length > 0) {
                    const firstVideo = data[0];
                    this.soundData.title = firstVideo.soundName || firstVideo.title || 'Original Sound';
                    this.soundData.userName = firstVideo.userName || 'Creator';
                    this.soundData.userPhoto = firstVideo.userPhoto || 'https://i.pravatar.cc/300?u=srk';
                    this.soundData.postCount = data.length;
                    this.soundData.url = firstVideo.videoUrl;
                }
            }
        });
    }

    useSound() {
        // Set the selected sound in service
        this.videoService.setSelectedSound({
            id: this.soundId,
            title: this.soundData.title,
            userName: this.soundData.userName,
            url: this.soundData.url
        });
        // Navigate to capture
        this.router.navigateByUrl('/capture');
    }

    formatCount(count: any): string {
        if (!count) return '0';
        const num = parseInt(count);
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
}
