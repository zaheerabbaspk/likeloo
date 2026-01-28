import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase.service';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl = 'http://localhost:5002/api';

  private uploadProgress = new BehaviorSubject<number>(0);
  public uploadProgress$ = this.uploadProgress.asObservable();

  private activeFeed = new BehaviorSubject<'following' | 'foryou'>('foryou');
  public activeFeed$ = this.activeFeed.asObservable();

  private pendingFile: File | null = null;
  private pendingPreviewUrl: string | null = null;
  private selectedSound = new BehaviorSubject<any>(null);
  public selectedSound$ = this.selectedSound.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) { }

  setPendingFile(file: File | null) {
    this.pendingFile = file;
    if (this.pendingPreviewUrl) {
      URL.revokeObjectURL(this.pendingPreviewUrl);
      this.pendingPreviewUrl = null;
    }
    if (file) {
      this.pendingPreviewUrl = URL.createObjectURL(file);
    }
  }

  getPendingFile(): File | null {
    return this.pendingFile;
  }

  getPendingPreviewUrl(): string | null {
    return this.pendingPreviewUrl;
  }

  setSelectedSound(sound: any) {
    this.selectedSound.next(sound);
  }

  getSelectedSound() {
    return this.selectedSound.getValue();
  }

  getVideosBySound(soundId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/videos/sound/${soundId}`);
  }

  setActiveFeed(feed: 'following' | 'foryou') {
    this.activeFeed.next(feed);
  }

  getFeed(): Observable<any[]> {
    console.log('Fetching feed from API...');
    return this.http.get<any[]>(`${this.apiUrl}/videos/feed?t=${Date.now()}`);
  }

  getFollowing(): Observable<any[]> {
    const user = this.authService.getCurrentUser();
    const userId = user?.uid || 'anonymous';
    return this.http.get<any[]>(`${this.apiUrl}/videos/following?userId=${userId}&t=${Date.now()}`);
  }

  getProfile(userId?: string): Observable<any> {
    const currentUserId = this.authService.getCurrentUser()?.uid;
    const finalUserId = userId || currentUserId;

    if (!finalUserId) {
      return new Observable(observer => {
        observer.error({ message: 'No user ID available. Please log in.' });
        observer.complete();
      });
    }

    const url = `${this.apiUrl}/videos/profile?userId=${finalUserId}&currentUserId=${currentUserId || ''}&t=${Date.now()}`;
    return this.http.get<any>(url);
  }

  getInbox(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/videos/inbox?t=${Date.now()}`);
  }

  /**
   * Unified Upload API: Sends the file directly to the Backend.
   * This avoids all CORS issues and makes the API extremely reliable.
   */
  uploadVideoUnified(description: string, file: File): Observable<any> {
    console.log('[VIDEO-SERVICE] Initiating Supabase Storage upload...');
    const user = this.authService.getCurrentUser();
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user?.uid || 'anonymous'}/${fileName}`;

    return new Observable(observer => {
      this.uploadProgress.next(10);

      // 1. Upload to Supabase Storage
      from(supabase.storage.from('videos').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'video/mp4'
      })).subscribe({
        next: async ({ data, error }) => {
          if (error) {
            console.error('[VIDEO-SERVICE] Supabase Upload Error:', error);
            this.uploadProgress.next(0);
            observer.error(error);
            return;
          }

          this.uploadProgress.next(50);
          console.log('[VIDEO-SERVICE] Supabase Upload Success:', data.path);

          // 2. Get Public URL
          const { data: publicData } = supabase.storage.from('videos').getPublicUrl(data.path);
          const publicUrl = publicData.publicUrl;
          console.log('[VIDEO-SERVICE] Public URL:', publicUrl);

          this.uploadProgress.next(70);

          // 3. Register with Backend
          const payload = {
            description,
            videoUrl: publicUrl,
            userId: user ? user.uid : 'anonymous',
            username: user ? (user.displayName || 'User') : 'User',
            userPhoto: user ? (user.photoURL || '') : '',
            soundId: this.getSelectedSound()?.id || '',
            soundName: this.getSelectedSound()?.title || 'Original sound',
            soundCreator: this.getSelectedSound()?.userName || user?.displayName || 'Creator'
          };

          this.http.post(`${this.apiUrl}/videos/upload`, payload).subscribe({
            next: (res) => {
              console.log('[VIDEO-SERVICE] Backend Registration Success:', res);
              this.uploadProgress.next(100);
              setTimeout(() => this.uploadProgress.next(0), 1000);
              observer.next(res);
              observer.complete();
            },
            error: (err) => {
              console.error('[VIDEO-SERVICE] Backend Registration Failure:', err);
              this.uploadProgress.next(0);
              observer.error(err);
            }
          });
        },
        error: (err) => {
          console.error('[VIDEO-SERVICE] Supabase Flow Failure:', err);
          this.uploadProgress.next(0);
          observer.error(err);
        }
      });
    });
  }

  likeVideo(id: string): Observable<any> {
    const user = this.authService.getCurrentUser();
    console.log('Liking video:', id, 'by user:', user?.uid);
    return this.http.post(`${this.apiUrl}/videos/like/${id}`, { userId: user?.uid });
  }

  getLikedVideos(userId: string): Observable<any[]> {
    console.log('Fetching liked videos for:', userId);
    return this.http.get<any[]>(`${this.apiUrl}/videos/liked?userId=${userId}&t=${Date.now()}`);
  }

  followUser(targetUserId: string): Observable<any> {
    const user = this.authService.getCurrentUser();
    console.log(`[VIDEO-SERVICE] User ${user?.uid} following ${targetUserId}`);
    return this.http.post(`${this.apiUrl}/videos/follow`, {
      followerId: user?.uid,
      followedId: targetUserId
    });
  }

  trackView(id: string): Observable<any> {
    console.log('Tracking view:', id);
    return this.http.post(`${this.apiUrl}/videos/view/${id}`, {});
  }

  getComments(videoId: string): Observable<any[]> {
    const userId = this.authService.getCurrentUser()?.uid || '';
    return this.http.get<any[]>(`${this.apiUrl}/videos/comments/${videoId}?userId=${userId}&t=${Date.now()}`);
  }

  likeComment(videoId: string, commentId: string): Observable<any> {
    const userId = this.authService.getCurrentUser()?.uid;
    return this.http.post(`${this.apiUrl}/videos/comment/${videoId}/like/${commentId}`, { userId });
  }

  addReply(videoId: string, commentId: string, text: string): Observable<any> {
    const user = this.authService.getCurrentUser();
    return this.http.post(`${this.apiUrl}/videos/comment/${videoId}/reply/${commentId}`, {
      text,
      userId: user?.uid,
      userName: user?.displayName || 'Toko User',
      userPhoto: user?.photoURL
    });
  }

  getReplies(commentId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/videos/comments/replies/${commentId}?t=${Date.now()}`);
  }

  searchUsers(term: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/videos/users/search?q=${term}`);
  }

  searchContent(term: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/videos/search?q=${term}`);
  }

  deleteVideo(videoId: string): Observable<any> {
    const userId = this.authService.getCurrentUser()?.uid;
    return this.http.post(`${this.apiUrl}/videos/video/${videoId}`, { userId });
  }

  addComment(videoId: string, text: string): Observable<any> {
    const user = this.authService.getCurrentUser();
    return this.http.post(`${this.apiUrl}/videos/comment/${videoId}`, {
      text,
      userId: user?.uid,
      userName: user?.displayName || 'Toko User',
      userPhoto: user?.photoURL
    });
  }
}
