import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSearchbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, notificationsOutline, flameOutline, trendingUpOutline } from 'ionicons/icons';
import { NavigationComponent } from '../../components/navigation/navigation.component';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.page.html',
  styleUrls: ['./explore.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSearchbar, CommonModule, NavigationComponent]
})
export class ExplorePage implements OnInit {
  categories = ['Action', 'Comedy', 'Dance', 'Design', 'Music', 'Nature', 'Fashion'];
  trending = [
    { title: 'Toko Designers', count: '1.2M' },
    { title: 'GlassUI Challenge', count: '850K' },
    { title: 'Ionic 2026', count: '420K' }
  ];

  constructor() {
    addIcons({ searchOutline, notificationsOutline, flameOutline, trendingUpOutline });
  }

  ngOnInit() {
  }
}
