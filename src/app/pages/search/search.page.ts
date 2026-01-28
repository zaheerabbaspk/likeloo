import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline, closeCircle, chevronBack, personCircle,
  checkmarkCircle, arrowUpOutline, ellipsisHorizontal,
  chevronForward, volumeMute, heartOutline, playOutline, arrowBackOutline
} from 'ionicons/icons';
import { VideoService } from '../../services/video';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonIcon]
})
export class SearchPage implements OnInit {
  searchTerm = '';
  activeTab: 'top' | 'videos' | 'photos' | 'users' | 'sounds' = 'top';

  users: any[] = [];
  videos: any[] = [];

  private searchSubject = new Subject<string>();

  constructor(
    private navCtrl: NavController,
    private videoService: VideoService,
    private router: Router
  ) {
    addIcons({ arrowBackOutline, searchOutline, closeCircle, ellipsisHorizontal, chevronForward, volumeMute, heartOutline, chevronBack, personCircle, checkmarkCircle, arrowUpOutline, playOutline });
  }

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  onSearchInput(event: any) {
    this.searchSubject.next(this.searchTerm);
  }

  performSearch(term: string) {
    if (!term.trim()) {
      this.clearResults();
      return;
    }

    // Search Users
    this.videoService.searchUsers(term).subscribe(res => {
      this.users = res;
    });

    // Search Videos
    this.videoService.searchContent(term).subscribe(res => {
      this.videos = res;
    });
  }

  clearResults() {
    this.users = [];
    this.videos = [];
  }

  goBack() {
    this.navCtrl.back();
  }

  clearSearch() {
    this.searchTerm = '';
    this.clearResults();
  }

  setTab(tab: any) {
    this.activeTab = tab;
  }

  followUser(event: Event, user: any) {
    event.stopPropagation();
    user.isFollowing = !user.isFollowing; // Optimistic update
    this.videoService.followUser(user.uid).subscribe({
      error: () => user.isFollowing = !user.isFollowing // Revert on error
    });
  }

  goToProfile(user: any) {
    this.router.navigate(['/user-detail', user.uid]);
  }

  formatCount(count: any): string {
    if (!count) return '0';
    const num = parseInt(count);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
