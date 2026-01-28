import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    }

    get client() {
        return this.supabase;
    }

    // Live Chat
    async sendLiveComment(streamId: string, userId: string, message: string, fullName: string, avatarUrl: string) {
        return await this.supabase
            .from('live_comments')
            .insert({
                stream_id: streamId,
                user_id: userId,
                message,
                full_name: fullName,
                avatar_url: avatarUrl
            });
    }

    subscribeToLiveComments(streamId: string): Observable<any> {
        const subject = new Subject<any>();

        this.supabase
            .channel(`live_comments:${streamId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'live_comments',
                    filter: `stream_id=eq.${streamId}`
                },
                (payload) => {
                    subject.next(payload.new);
                }
            )
            .subscribe();

        return subject.asObservable();
    }

    // Follow System
    async followUser(followerId: string, followingId: string) {
        return await this.supabase
            .from('follows')
            .insert({
                follower_id: followerId,
                following_id: followingId
            });
    }

    async unfollowUser(followerId: string, followingId: string) {
        return await this.supabase
            .from('follows')
            .delete()
            .match({ follower_id: followerId, following_id: followingId });
    }


    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        const { data } = await this.supabase
            .from('follows')
            .select('*')
            .match({ follower_id: followerId, following_id: followingId })
            .single();

        return !!data;
    }

    // Live Sessions
    async startSession(
        streamId: string,
        hostId: string,
        hostName: string,
        hostAvatar: string,
        title?: string,
        thumbnailUrl?: string
    ) {
        return await this.supabase
            .from('live_sessions')
            .insert({
                stream_id: streamId,
                host_id: hostId,
                host_name: hostName,
                host_avatar: hostAvatar,
                status: 'live',
                title,
                thumbnail_url: thumbnailUrl
            });
    }

    async endSession(streamId: string) {
        return await this.supabase
            .from('live_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('stream_id', streamId);
    }

    async getActiveSessions() {
        return await this.supabase
            .from('live_sessions')
            .select('*')
            .eq('status', 'live')
            .order('started_at', { ascending: false });
    }

    subscribeToActiveSessions(): Observable<any> {
        const subject = new Subject<any>();

        this.supabase
            .channel('public:live_sessions')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_sessions'
                },
                (payload) => {
                    subject.next(payload);
                }
            )
            .subscribe();

        return subject.asObservable();
    }

    // Live Likes
    async sendLiveLike(streamId: string, userId: string | null = null, count: number = 1) {
        return await this.supabase
            .from('live_likes')
            .insert({
                stream_id: streamId,
                user_id: userId,
                count
            });
    }

    subscribeToLiveLikes(streamId: string): Observable<any> {
        const subject = new Subject<any>();

        this.supabase
            .channel(`live_likes:${streamId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'live_likes',
                    filter: `stream_id=eq.${streamId}`
                },
                (payload) => {
                    subject.next(payload.new);
                }
            )
            .subscribe();

        return subject.asObservable();
    }
}

export const supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
