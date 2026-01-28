import { Component, OnInit } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonLabel, IonItem, IonList, IonAvatar, IonBadge } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { chatbubbleEllipsesOutline, heartOutline, personAddOutline, settingsOutline, addCircle, chevronForwardOutline, searchOutline, personAdd, archiveOutline, close, caretDown, add } from 'ionicons/icons';
import { NavigationComponent } from '../../components/navigation/navigation.component';
import { VideoService } from '../../services/video';
import { ChatService } from '../../services/chat.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-inbox',
  templateUrl: './inbox.page.html',
  styleUrls: ['./inbox.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonLabel, IonItem, IonList, IonAvatar, IonBadge, CommonModule, NavigationComponent]
})
export class InboxPage implements OnInit {
  stories: any[] = [];
  activities: any[] = [];
  conversations: any[] = [];

  constructor(
    private videoService: VideoService,
    private chatService: ChatService,
    private router: Router
  ) {
    addIcons({
      addCircle, caretDown, searchOutline, close, add, personAdd,
      chevronForwardOutline, archiveOutline, chatbubbleEllipsesOutline,
      heartOutline, personAddOutline, settingsOutline, heart: heartOutline
    });
  }

  ngOnInit() {
    this.videoService.getInbox().subscribe({
      next: (data) => {
        this.stories = data.stories;
        this.activities = data.activities;
      }
    });

    this.loadConversations();
  }

  loadConversations() {
    this.chatService.getConversations().subscribe(res => {
      this.conversations = res;
    });
  }

  openChat(conversation: any) {
    this.router.navigate(['/chat', conversation.otherUser.uid]);
  }
}
