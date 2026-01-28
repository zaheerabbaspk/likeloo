import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController, IonHeader, IonToolbar, IonTitle, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  playOutline, chevronForward, logoFacebook, logoGoogle, logoApple,
  logoTwitter, logoInstagram, personOutline, closeOutline, helpCircleOutline,
  chevronBack, caretDown
} from 'ionicons/icons';
import { VideoService } from '../../services/video';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButton]
})
export class LoginPage implements OnInit {

  // State Management
  viewState: 'landing' | 'form' | 'otp' = 'landing';
  authMode: 'login' | 'signup' = 'signup';
  formTab: 'phone' | 'email' = 'phone';
  isLoading = false;

  // Form Data
  email = '';
  password = '';
  phone = '';
  otp = '';
  countryCode = 'PK +92';

  constructor(
    private router: Router,
    private videoService: VideoService,
    private toastCtrl: ToastController,
    private authService: AuthService
  ) {
    addIcons({ chevronBack, closeOutline, helpCircleOutline, personOutline, logoFacebook, logoGoogle, logoInstagram, logoTwitter, logoApple, caretDown, playOutline, chevronForward });
  }

  ngOnInit() { }

  // Navigation Logic
  toggleAuthMode() {
    this.authMode = this.authMode === 'login' ? 'signup' : 'login';
    this.viewState = 'landing';
    this.resetForm();
  }

  openForm(tab: 'phone' | 'email') {
    this.formTab = tab;
    this.viewState = 'form';
  }

  goBackToLanding() {
    if (this.viewState === 'otp') {
      this.viewState = 'form';
      this.otp = '';
    } else {
      this.viewState = 'landing';
      this.resetForm();
    }
  }

  resetForm() {
    this.email = '';
    this.password = '';
    this.phone = '';
    this.otp = '';
  }

  // ========== GOOGLE LOGIN ==========
  async handleSocialLogin(provider: string) {
    if (provider === 'google') {
      try {
        this.isLoading = true;
        console.log('Starting Google login...');
        const user = await this.authService.loginWithGoogle();
        if (user) {
          const welcomeMsg = user.displayName ? `Welcome, ${user.displayName}! 👋` : 'Welcome! 👋';
          await this.showToast(welcomeMsg, 'success');
          this.router.navigateByUrl('/home');
        }
      } catch (error: any) {
        console.error('Login error in page:', error);
        const errorMsg = error.message || 'Login failed. Please try again.';
        this.showToast(errorMsg, 'danger');
      } finally {
        this.isLoading = false;
      }
    } else {
      this.showToast(`${provider} login coming soon!`, 'medium');
    }
  }

  // ========== EMAIL/PASSWORD AUTH ==========
  async submitEmailAuth() {
    if (!this.email || !this.password) {
      this.showToast('Please enter email and password');
      return;
    }

    try {
      this.isLoading = true;
      let user;

      if (this.authMode === 'signup') {
        user = await this.authService.signupWithEmail(this.email, this.password);
        await this.showToast('Account created! 🚀', 'success');
      } else {
        user = await this.authService.loginWithEmail(this.email, this.password);
        await this.showToast('Welcome back! ✨', 'success');
      }

      this.router.navigateByUrl('/home');
    } catch (error: any) {
      console.error('Email auth error:', error);
      this.showToast(error.message || 'Authentication failed', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ========== PHONE OTP AUTH ==========
  async sendOTP() {
    if (!this.phone) {
      this.showToast('Please enter phone number');
      return;
    }

    try {
      this.isLoading = true;
      await this.authService.sendOTP(this.phone);
      this.viewState = 'otp';
      await this.showToast('OTP sent! 📱', 'success');
    } catch (error: any) {
      console.error('Send OTP error:', error);
      this.showToast(error.message || 'Failed to send OTP', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async verifyOTP() {
    if (!this.otp || this.otp.length < 6) {
      this.showToast('Please enter 6-digit OTP');
      return;
    }

    try {
      this.isLoading = true;
      const user = await this.authService.verifyOTP(this.otp);
      await this.showToast('Phone verified! 🎉', 'success');
      this.router.navigateByUrl('/home');
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      this.showToast(error.message || 'Invalid OTP', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ========== FORM SUBMISSION HANDLER ==========
  async submitAuth() {
    if (this.formTab === 'email') {
      await this.submitEmailAuth();
    } else if (this.formTab === 'phone') {
      await this.sendOTP();
    }
  }

  async showToast(msg: string, color: string = 'dark') {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      color: color,
      position: 'top',
      cssClass: 'custom-toast'
    });
    toast.present();
  }
}
