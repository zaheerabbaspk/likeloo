import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { AuthService } from './auth.service';
// import { db } from '../app.module'; 

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    private apiUrl = 'http://localhost:5002/api/chat';

    constructor(private http: HttpClient, private authService: AuthService) { }

    sendMessage(receiverId: string, text: string, receiverInfo: any): Observable<any> {
        const user = this.authService.getCurrentUser();
        const payload = {
            senderId: user?.uid,
            senderName: user?.displayName,
            senderPhoto: user?.photoURL,
            receiverId,
            receiverName: receiverInfo.displayName || receiverInfo.username,
            receiverPhoto: receiverInfo.photoURL || receiverInfo.avatar,
            text
        };
        return this.http.post(`${this.apiUrl}/send`, payload);
    }

    getConversations(): Observable<any[]> {
        const user = this.authService.getCurrentUser();
        return this.http.get<any[]>(`${this.apiUrl}/conversations/${user?.uid}`);
    }

    markAsSeen(otherUserId: string): Observable<any> {
        const user = this.authService.getCurrentUser();
        return this.http.post(`${this.apiUrl}/seen`, {
            userId: user?.uid,
            otherUserId
        });
    }

    // To get real-time messages, we would ideally use the firebase sdk directly on the frontend
    // This project uses standalone components and direct imports.
}
