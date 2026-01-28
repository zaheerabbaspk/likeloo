import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    User,
    onAuthStateChanged,
    signInWithCredential,
    GoogleAuthProvider as GoogleProviderAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    ConfirmationResult,
    updateProfile
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    public app = initializeApp(environment.firebase);
    private auth = getAuth(this.app);
    private googleProvider = new GoogleAuthProvider();

    // For phone OTP verification
    private confirmationResult: ConfirmationResult | null = null;
    private recaptchaVerifier: RecaptchaVerifier | null = null;

    private userSubject = new BehaviorSubject<User | null>(null);
    public user$ = this.userSubject.asObservable();

    constructor(private router: Router) {
        onAuthStateChanged(this.auth, (user: User | null) => {
            this.userSubject.next(user);
            console.log('Auth state changed:', user?.displayName, user?.email);
            if (user) {
                localStorage.setItem('toko_auth', 'true');
            } else {
                localStorage.removeItem('toko_auth');
            }
        });

        // Initialize Capgo Social Login for native
        if (Capacitor.isNativePlatform()) {
            this.initializeSocialLogin();
        }
    }

    private async initializeSocialLogin() {
        try {
            await SocialLogin.initialize({
                google: {
                    webClientId: environment.googleClientId,
                }
            });
            console.log('Capgo SocialLogin initialized successfully');
        } catch (e) {
            console.warn('Capgo SocialLogin init failed:', e);
        }
    }

    // ========== EMAIL/PASSWORD AUTHENTICATION ==========

    async signupWithEmail(email: string, password: string): Promise<User> {
        try {
            console.log('Signing up with email:', email);
            const result = await createUserWithEmailAndPassword(this.auth, email, password);
            console.log('Email signup successful:', result.user.email);
            return result.user;
        } catch (error: any) {
            console.error('Email signup error:', error.code, error.message);
            throw this.handleAuthError(error);
        }
    }

    async loginWithEmail(email: string, password: string): Promise<User> {
        try {
            console.log('Logging in with email:', email);
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            console.log('Email login successful:', result.user.email);
            return result.user;
        } catch (error: any) {
            console.error('Email login error:', error.code, error.message);
            throw this.handleAuthError(error);
        }
    }

    async resetPassword(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(this.auth, email);
            console.log('Password reset email sent to:', email);
        } catch (error: any) {
            console.error('Password reset error:', error.code);
            throw this.handleAuthError(error);
        }
    }

    // ========== PHONE OTP AUTHENTICATION ==========

    async sendOTP(phoneNumber: string, recaptchaContainerId: string = 'recaptcha-container'): Promise<void> {
        try {
            console.log('Sending OTP to:', phoneNumber);

            // Initialize recaptcha verifier
            if (!this.recaptchaVerifier) {
                this.recaptchaVerifier = new RecaptchaVerifier(this.auth, recaptchaContainerId, {
                    size: 'invisible',
                    callback: () => {
                        console.log('reCAPTCHA solved');
                    }
                });
            }

            // Format phone number (add country code if not present)
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+92${phoneNumber}`;

            this.confirmationResult = await signInWithPhoneNumber(this.auth, formattedPhone, this.recaptchaVerifier);
            console.log('OTP sent successfully');
        } catch (error: any) {
            console.error('Send OTP error:', error.code, error.message);
            // Reset recaptcha on error
            this.recaptchaVerifier = null;
            throw this.handleAuthError(error);
        }
    }

    async verifyOTP(otp: string): Promise<User> {
        try {
            if (!this.confirmationResult) {
                throw new Error('No OTP was sent. Please request a new code.');
            }

            console.log('Verifying OTP...');
            const result = await this.confirmationResult.confirm(otp);
            console.log('OTP verification successful:', result.user.phoneNumber);

            // Clear the confirmation result
            this.confirmationResult = null;

            return result.user;
        } catch (error: any) {
            console.error('OTP verification error:', error.code, error.message);
            throw this.handleAuthError(error);
        }
    }

    // ========== GOOGLE AUTHENTICATION ==========

    async loginWithGoogle(): Promise<User | null> {
        console.log('loginWithGoogle called, platform:', Capacitor.getPlatform());

        if (Capacitor.isNativePlatform()) {
            return this.nativeGoogleLogin();
        } else {
            return this.webGoogleLogin();
        }
    }

    private async nativeGoogleLogin(): Promise<User | null> {
        try {
            console.log('Attempting native Google login...');
            const result = await SocialLogin.login({
                provider: 'google',
                options: {
                    scopes: ['email', 'profile']
                }
            });

            if (result.result.responseType === 'online' && result.result.idToken) {
                const credential = GoogleProviderAuth.credential(result.result.idToken);
                const userCredential = await signInWithCredential(this.auth, credential);
                console.log('Native login successful:', userCredential.user.displayName);
                return userCredential.user;
            }
            throw new Error('No idToken received from native login');
        } catch (error: any) {
            console.error('Native Google Login Error:', error);
            throw error;
        }
    }

    private async webGoogleLogin(): Promise<User | null> {
        try {
            console.log('Attempting web popup Google login...');

            this.googleProvider.setCustomParameters({
                prompt: 'select_account'
            });

            const result = await signInWithPopup(this.auth, this.googleProvider);
            console.log('Web popup login successful:', result.user.displayName);
            return result.user;
        } catch (error: any) {
            console.error('Web Google Login Error:', error.code, error.message);
            throw this.handleAuthError(error);
        }
    }

    // ========== COMMON METHODS ==========

    async logout() {
        try {
            if (Capacitor.isNativePlatform()) {
                await SocialLogin.logout({ provider: 'google' });
            }
        } catch (e) {
            // Ignore native logout error
        }
        await signOut(this.auth);
        console.log('User logged out');
    }

    getCurrentUser() {
        return this.auth.currentUser;
    }

    isLoggedIn(): boolean {
        return !!this.auth.currentUser;
    }

    // ========== PROFILE MANAGEMENT ==========
    async updateUserProfile(data: { displayName?: string, photoURL?: string, username?: string }): Promise<void> {
        const user = this.auth.currentUser;
        if (!user) throw new Error('No user logged in');

        try {
            console.log('Updating user profile metadata:', data);

            // 1. Update Firebase Auth (for displayName and photoURL)
            if (data.displayName || data.photoURL) {
                await updateProfile(user, {
                    displayName: data.displayName || user.displayName,
                    photoURL: data.photoURL || user.photoURL
                });
            }

            // 2. Sync everything to RTDB including custom 'username'
            const RTDB_URL = environment.firebase.databaseURL.replace(/\/$/, '');
            const syncData: any = {
                updatedAt: Date.now()
            };
            if (data.displayName) syncData.displayName = data.displayName;
            if (data.photoURL) syncData.photoURL = data.photoURL;
            if (data.username) syncData.username = data.username.toLowerCase().replace(/\s/g, '');

            await fetch(`${RTDB_URL}/users/${user.uid}.json`, {
                method: 'PATCH',
                body: JSON.stringify(syncData)
            });

            console.log('Profile sync complete');

            // 3. IMPORTANT: Update the local observer with fresh data
            // We create a new object to trigger Angular change detection
            this.userSubject.next(Object.assign(Object.create(Object.getPrototypeOf(user)), user));

        } catch (error: any) {
            console.error('Update profile error:', error);
            throw this.handleAuthError(error);
        }
    }

    // Error message handler
    private handleAuthError(error: any): Error {
        const errorMessages: { [key: string]: string } = {
            'auth/email-already-in-use': 'This email is already registered. Please login instead.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/popup-blocked': 'Popup was blocked. Please allow popups.',
            'auth/popup-closed-by-user': 'Login cancelled.',
            'auth/unauthorized-domain': 'This domain is not authorized.',
            'auth/invalid-phone-number': 'Invalid phone number format.',
            'auth/invalid-verification-code': 'Invalid OTP code. Please try again.',
            'auth/code-expired': 'OTP expired. Please request a new code.',
            'auth/missing-phone-number': 'Please enter a phone number.',
        };

        const message = errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
        return new Error(message);
    }
}
