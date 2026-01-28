import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, NavController, IonAvatar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBack, ellipsisHorizontal, flagOutline, camera,
  imageOutline, happyOutline, paperPlaneOutline,
  mic, personAdd, checkmarkCircle
} from 'ionicons/icons';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { VideoService } from '../../services/video';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonIcon, IonAvatar],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatPage implements OnInit, OnDestroy {
  receiverId: string | null = null;
  receiver: any = null;
  currentUser: any = null;
  messages: any[] = [];
  newMessage = '';

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    private authService: AuthService,
    private videoService: VideoService,
    private navCtrl: NavController
  ) {
    addIcons({
      chevronBack, ellipsisHorizontal, flagOutline, camera,
      imageOutline, happyOutline, mic, paperPlaneOutline,
      personAdd, checkmarkCircle
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.route.paramMap.subscribe(params => {
      this.receiverId = params.get('id');
      if (this.receiverId) {
        this.loadReceiverProfile();
        this.loadMessages();
        this.chatService.markAsSeen(this.receiverId).subscribe();
      }
    });
  }

  ngOnDestroy() {
    // Clean up listeners if any
  }

  loadReceiverProfile() {
    this.videoService.getProfile(this.receiverId!).subscribe(res => {
      this.receiver = res;
    });
  }

  loadMessages() {
    // In a real app, this would be a real-time listener
    // For now we mock the history or fetch once
    this.messages = [
      { id: '1', senderId: this.receiverId, text: 'Hy', timestamp: Date.now() - 60000 }
    ];
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.receiverId) return;

    const text = this.newMessage;
    this.newMessage = '';

    // Optimistic update
    const tempMsg = {
      id: Date.now().toString(),
      senderId: this.currentUser.uid,
      text: text,
      timestamp: Date.now()
    };
    this.messages.push(tempMsg);

    this.chatService.sendMessage(this.receiverId, text, this.receiver).subscribe({
      error: (err) => {
        console.error('Send error:', err);
        // Optionally remove from list or show error
      }
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  formatDate(timestamp: number) {
    const date = new Date(timestamp);
    return `Today ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')} ${date.getHours() >= 12 ? 'AM' : 'PM'}`;
  }
}
