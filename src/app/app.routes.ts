import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'explore',
    loadComponent: () => import('./pages/explore/explore.page').then(m => m.ExplorePage)
  },
  {
    path: 'inbox',
    loadComponent: () => import('./pages/inbox/inbox.page').then(m => m.InboxPage)
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
  },
  {
    path: 'capture',
    loadComponent: () => import('./pages/upload/capture/capture.page').then(m => m.CapturePage)
  },
  {
    path: 'preview',
    loadComponent: () => import('./pages/upload/preview/preview.page').then(m => m.PreviewPage)
  },
  {
    path: 'post',
    loadComponent: () => import('./pages/upload/post/post.page').then(m => m.PostPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.page').then(m => m.SearchPage)
  },
  {
    path: 'edit-profile',
    loadComponent: () => import('./pages/profile/edit-profile/edit-profile.page').then(m => m.EditProfilePage)
  },
  {
    path: 'sound/:id',
    loadComponent: () => import('./pages/sound/sound.page').then(m => m.SoundPage)
  },
  {
    path: 'user-detail/:id',
    loadComponent: () => import('./pages/user-detail/user-detail.page').then(m => m.UserDetailPage)
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage)
  },
  {
    path: 'live/:id',
    loadComponent: () => import('./pages/live/live.page').then(m => m.LivePage)
  },
  {
    path: 'live-broadcast',
    loadComponent: () => import('./pages/live-broadcast/live-broadcast.page').then(m => m.LiveBroadcastPage)
  },
];
