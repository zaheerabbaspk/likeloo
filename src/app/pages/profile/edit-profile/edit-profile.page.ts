import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, NavController, IonInput, IonItem, IonList, IonLabel, IonButton, IonModal, ToastController, LoadingController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, cameraOutline, copyOutline, chevronForward, camera, person, close } from 'ionicons/icons';
import { AuthService } from '../../../services/auth.service';
import { supabase } from '../../../services/supabase.service';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonIcon, IonButton, IonModal, IonInput, IonItem, IonList, IonLabel]
})
export class EditProfilePage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  user: any = null;
  editData = {
    displayName: '',
    photoURL: '',
    username: ''
  };

  showEditModal = false;
  editingField: 'name' | 'username' | 'bio' = 'name';
  tempValue = '';

  constructor(
    private navCtrl: NavController,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ chevronBack, person, cameraOutline, chevronForward, copyOutline, camera, close });
  }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.user = user;
      if (user) {
        this.editData.displayName = user.displayName || '';
        this.editData.photoURL = user.photoURL || '';
        this.loadExtraMetadata(user.uid);
      }
    });
  }

  async loadExtraMetadata(uid: string) {
    try {
      // Fetch custom fields like 'username' from RTDB
      const RTDB_URL = 'https://likelo-27611-default-rtdb.asia-southeast1.firebasedatabase.app';
      const response = await fetch(`${RTDB_URL}/users/${uid}.json`);
      const data = await response.json();
      if (data && data.username) {
        this.editData.username = data.username;
      }
    } catch (e) {
      console.warn('Could not load extra metadata');
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  triggerPhoto() {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const loading = await this.loadingCtrl.create({
      message: 'Uploading photo...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const fileName = `avatar_${Date.now()}_${file.name}`;
      const filePath = `avatars/${this.user.uid}/${fileName}`;

      // 1. Upload to Supabase
      const { data, error } = await supabase.storage
        .from('videos') // Reusing videos bucket for simplicity or use 'avatars' if created
        .upload(filePath, file);

      if (error) throw error;

      // 2. Get Public URL
      const { data: publicData } = supabase.storage.from('videos').getPublicUrl(filePath);
      const photoURL = publicData.publicUrl;

      // 3. Update Profile
      await this.authService.updateUserProfile({ photoURL });

      this.showToast('Profile photo updated! ✨', 'success');
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      this.showToast('Failed to upload photo', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  editField(field: 'name' | 'username' | 'bio') {
    this.editingField = field;
    if (field === 'name') this.tempValue = this.editData.displayName;
    else if (field === 'username') this.tempValue = this.editData.username;
    else this.tempValue = '';

    this.showEditModal = true;
  }

  async saveField() {
    if (!this.tempValue.trim()) return;

    const loading = await this.loadingCtrl.create({ message: 'Saving...' });
    await loading.present();

    try {
      if (this.editingField === 'name') {
        await this.authService.updateUserProfile({ displayName: this.tempValue });
        this.editData.displayName = this.tempValue;
      } else if (this.editingField === 'username') {
        const cleanUsername = this.tempValue.toLowerCase().replace(/\s/g, '');
        await this.authService.updateUserProfile({ username: cleanUsername });
        this.editData.username = cleanUsername;
      }

      this.showToast(`${this.editingField.toUpperCase()} updated!`, 'success');
      this.showEditModal = false;
    } catch (err) {
      this.showToast('Update failed', 'danger');
    } finally {
      loading.dismiss();
    }
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

  copyLink() {
    const link = `tokotok.com/@${this.user?.displayName || 'user'}`;
    navigator.clipboard.writeText(link);
    this.showToast('Link copied to clipboard! 📋');
  }
}

