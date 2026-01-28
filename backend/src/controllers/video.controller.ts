import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

// Storage Configuration for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const dest = path.resolve('uploads');
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            cb(null, dest);
        } catch (e) {
            cb(e as Error, '');
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.mp4';
        const name = `toko-${Date.now()}${ext}`;
        cb(null, name);
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

const RTDB_URL = process.env.FIREBASE_RTDB_URL?.replace(/\/$/, '') || 'https://likelo-27611-default-rtdb.asia-southeast1.firebasedatabase.app';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5002';

// Helper to interact with Firebase RTDB via REST
const firebaseFetch = async (path: string, options: any = {}) => {
    const url = `${RTDB_URL}/${path}.json`;
    console.log(`Backend calling: ${url}`);
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firebase Error: ${response.statusText} - ${errorText}`);
    }
    return response.json();
};

export const getFeed = async (req: Request, res: Response) => {
    try {
        const data = await firebaseFetch('videos');
        const videos = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse() : [];
        res.json(videos);
    } catch (error) {
        console.error('getFeed error:', error);
        res.status(500).json({ message: 'Error fetching feed' });
    }
};

export const uploadVideo = async (req: Request, res: Response) => {
    console.log('[UPLOAD-API] Incoming request...');
    try {
        // Log body for debugging (avoid logging huge files)
        console.log('[UPLOAD-API] Body:', { ...req.body, video: req.file ? 'File detected' : 'No file' });

        const { description, userId, username, userPhoto, videoUrl: bodyVideoUrl } = req.body;
        const file = req.file;

        let videoUrl = bodyVideoUrl;

        // Priority 1: Direct File Upload
        if (file) {
            console.log('[UPLOAD-API] Processing local file:', file.filename);
            videoUrl = `${BASE_URL}/uploads/${file.filename}`;
        }

        // Priority 2: Injected URL (e.g. from a cloud service or previous step)
        if (!videoUrl) {
            console.error('[UPLOAD-API] FAILURE: No video source provided');
            return res.status(400).json({
                success: false,
                message: 'No video file or URL provided. Please select a video.'
            });
        }

        console.log('[UPLOAD-API] Final Video URL:', videoUrl);

        const newVideo = {
            url: videoUrl,
            creator: username || '@user',
            userId: userId || 'anonymous',
            userPhoto: userPhoto || 'https://i.pravatar.cc/150?u=anonymous',
            description: description || 'New Toko Video',
            likes: 0,
            comments: 0,
            shares: 0,
            music: 'Original Sound',
            views: 0,
            createdAt: Date.now()
        };

        console.log('[UPLOAD-API] Registering in Firebase RTDB...');
        const result = await firebaseFetch('videos', {
            method: 'POST',
            body: JSON.stringify(newVideo)
        });

        console.log('[UPLOAD-API] SUCCESS! ID:', result.name);
        res.json({
            success: true,
            message: 'Upload successful',
            video: { id: result.name, ...newVideo }
        });

    } catch (error: any) {
        console.error('[UPLOAD-API] CRITICAL ERROR:', error);
        res.status(500).json({
            success: false,
            message: 'Upload failed at database registration',
            details: error.message
        });
    }
};

export const likeVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) return res.status(400).json({ message: 'User ID required' });

        console.log(`[LIKE-API] Processing like for video ${id} by user ${userId}`);

        // 1. Check if user has already liked this video (CRITICAL: One like per user)
        const alreadyLiked = await firebaseFetch(`user_likes/${userId}/${id}`);
        if (alreadyLiked) {
            console.log(`[LIKE-API] User ${userId} already liked video ${id}. Ignoring.`);
            return res.status(400).json({ message: 'User already liked this video' });
        }

        // 2. Increment total like count on the video
        const video = await firebaseFetch(`videos/${id}`);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const newLikes = (parseInt(video.likes) || 0) + 1;
        await firebaseFetch(`videos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ likes: newLikes })
        });

        // 3. Register the like in user_likes node
        await firebaseFetch(`user_likes/${userId}/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                likedAt: Date.now(),
                videoUrl: video.url,
                thumbnail: video.url
            })
        });

        return res.json({ success: true, message: 'Liked', likes: newLikes });
    } catch (e) {
        console.error('[LIKE-API] Error:', e);
        res.status(500).json({ message: 'Error Liking' });
    }
};

export const getLikedVideos = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        console.log(`[LIKED-VIDEOS-API] Fetching likes for: ${userId}`);

        // 1. Get all liked video IDs from user_likes
        const likedData = await firebaseFetch(`user_likes/${userId}`);
        if (!likedData) return res.json([]);

        // 2. Fetch all videos to find the details (In a larger app, we'd fetch by ID individually)
        const allVideos = await firebaseFetch('videos');
        if (!allVideos) return res.json([]);

        const likedVideoIds = Object.keys(likedData);
        const likedVideos = likedVideoIds
            .map(id => allVideos[id] ? { id, ...allVideos[id] } : null)
            .filter(v => v !== null)
            .reverse();

        res.json(likedVideos);
    } catch (error) {
        console.error('[LIKED-VIDEOS-API] Error:', error);
        res.status(500).json({ message: 'Error fetching liked videos' });
    }
};

export const trackView = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const video = await firebaseFetch(`videos/${id}`);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const newViews = (parseInt(video.views) || 0) + 1;
        await firebaseFetch(`videos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ views: newViews })
        });
        return res.json({ success: true, message: 'View tracked', views: newViews });
    } catch (e) {
        console.error('[VIEW-API] Error:', e);
        res.status(500).json({ message: 'Error tracking view' });
    }
};

export const followUser = async (req: Request, res: Response) => {
    try {
        const { followerId, followedId } = req.body;
        if (!followerId || !followedId) return res.status(400).json({ message: 'Both IDs required' });

        console.log(`[FOLLOW-API] User ${followerId} following ${followedId}`);

        // 1. Add to following list
        await firebaseFetch(`following/${followerId}/${followedId}`, {
            method: 'PUT',
            body: JSON.stringify({ followedAt: Date.now() })
        });

        // 2. Add to followers list
        await firebaseFetch(`followers/${followedId}/${followerId}`, {
            method: 'PUT',
            body: JSON.stringify({ followerAt: Date.now() })
        });

        res.json({ success: true, message: 'Followed successfully' });
    } catch (e) {
        console.error('[FOLLOW-API] Error:', e);
        res.status(500).json({ message: 'Error following' });
    }
};

export const getFollowingContent = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.json([]);

        // 1. Get list of followed users
        const following = await firebaseFetch(`following/${userId}`);
        if (!following) return res.json([]);

        // 2. Get all videos and filter
        const allVideos = await firebaseFetch('videos');
        if (!allVideos) return res.json([]);

        const followedIds = Object.keys(following);
        const filtered = Object.keys(allVideos)
            .map(id => ({ id, ...allVideos[id] }))
            .filter(v => followedIds.includes(v.userId))
            .reverse();

        res.json(filtered);
    } catch (e) {
        res.status(500).json({ message: 'Error' });
    }
};

export const addComment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // videoId
        const { text, userId, userName, userPhoto } = req.body;

        if (!text) return res.status(400).json({ message: 'Comment text required' });

        console.log(`[COMMENT-API] Adding comment to ${id} by ${userName}`);

        const commentId = Date.now().toString();
        const commentData = {
            id: commentId,
            text,
            userId,
            userName: userName || 'User',
            userPhoto: userPhoto || 'https://i.pravatar.cc/150?u=anon',
            createdAt: Date.now(),
            likes: 0,
            replyCount: 0
        };

        // 1. Add to comments node
        await firebaseFetch(`comments/${id}/${commentId}`, {
            method: 'PUT',
            body: JSON.stringify(commentData)
        });

        // 2. Increment comment count on the video
        const video = await firebaseFetch(`videos/${id}`);
        if (video) {
            const newCount = (parseInt(video.comments) || 0) + 1;
            await firebaseFetch(`videos/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ comments: newCount })
            });
        }

        res.json({ success: true, message: 'Comment added' });
    } catch (e) {
        console.error('[COMMENT-API] Error:', e);
        res.status(500).json({ message: 'Error adding comment' });
    }
};

export const getComments = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // videoId
        const { userId } = req.query; // current user to check liked state
        const data = await firebaseFetch(`comments/${id}`);

        if (!data) return res.json([]);

        const comments = await Promise.all(Object.keys(data).map(async key => {
            const comment = { id: key, ...data[key] };

            // Check if current user liked this comment
            if (userId) {
                const like = await firebaseFetch(`comment_likes/${key}/${userId}`);
                comment.isLiked = !!like;
            }

            return comment;
        }));

        res.json(comments.reverse()); // Newest first
    } catch (e) {
        console.error('[COMMENT-API] Fetch Error:', e);
        res.status(500).json({ message: 'Error fetching comments' });
    }
};

export const likeComment = async (req: Request, res: Response) => {
    try {
        const { videoId, commentId } = req.params;
        const { userId } = req.body;

        if (!userId) return res.status(400).json({ message: 'UserId required' });

        // 1. Check if already liked
        const existingLike = await firebaseFetch(`comment_likes/${commentId}/${userId}`);
        const comment = await firebaseFetch(`comments/${videoId}/${commentId}`);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        let newLikes = parseInt(comment.likes) || 0;

        if (existingLike) {
            // Unlike
            await firebaseFetch(`comment_likes/${commentId}/${userId}`, { method: 'DELETE' });
            newLikes = Math.max(0, newLikes - 1);
        } else {
            // Like
            await firebaseFetch(`comment_likes/${commentId}/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ likedAt: Date.now() })
            });
            newLikes = newLikes + 1;
        }

        // Update comment likes count
        await firebaseFetch(`comments/${videoId}/${commentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ likes: newLikes })
        });

        res.json({ success: true, isLiked: !existingLike, likes: newLikes });
    } catch (e) {
        console.error('[LIKE-COMMENT-API] Error:', e);
        res.status(500).json({ message: 'Error liking comment' });
    }
};

export const addReply = async (req: Request, res: Response) => {
    try {
        const { videoId, commentId } = req.params;
        const { text, userId, userName, userPhoto } = req.body;

        if (!text) return res.status(400).json({ message: 'Reply text required' });

        const replyId = Date.now().toString();
        const replyData = {
            id: replyId,
            text,
            userId,
            userName: userName || 'User',
            userPhoto: userPhoto || 'https://i.pravatar.cc/150?u=anon',
            createdAt: Date.now(),
            likes: 0
        };

        // 1. Store in replies node
        await firebaseFetch(`replies/${commentId}/${replyId}`, {
            method: 'PUT',
            body: JSON.stringify(replyData)
        });

        // 2. Increment parent comment reply count
        const comment = await firebaseFetch(`comments/${videoId}/${commentId}`);
        if (comment) {
            const newCount = (parseInt(comment.replyCount) || 0) + 1;
            await firebaseFetch(`comments/${videoId}/${commentId}`, {
                method: 'PATCH',
                body: JSON.stringify({ replyCount: newCount })
            });
        }

        res.json({ success: true, reply: replyData });
    } catch (e) {
        console.error('[REPLY-API] Error:', e);
        res.status(500).json({ message: 'Error adding reply' });
    }
};

export const getReplies = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const data = await firebaseFetch(`replies/${commentId}`);
        if (!data) return res.json([]);

        const replies = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        res.json(replies);
    } catch (e) {
        console.error('[REPLIES-FETCH-API] Error:', e);
        res.status(500).json({ message: 'Error fetching replies' });
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const { userId, currentUserId } = req.query;
        if (!userId) return res.status(400).json({ message: 'UserId required' });

        // 1. Fetch User Metadata (Custom Username, Photo, etc)
        let userData: any = null;
        try {
            userData = await firebaseFetch(`users/${userId}`);
        } catch (e) {
            console.warn('Metadata fetch failed for user:', userId);
        }

        // 2. Fetch User Videos
        const data = await firebaseFetch('videos');

        let userVideos: any[] = [];
        let totalReceivedLikes = 0;

        if (data) {
            userVideos = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(v => v.userId === userId);

            // Calculate real likes from videos
            totalReceivedLikes = userVideos.reduce((acc, curr) => acc + (parseInt(curr.likes) || 0), 0);
        }

        // 3. Fetch Social Counts (Followers/Following)
        const followerData = await firebaseFetch(`followers/${userId}`);
        const followingData = await firebaseFetch(`following/${userId}`);

        const followersCount = followerData ? Object.keys(followerData).length : 0;
        const followingCount = followingData ? Object.keys(followingData).length : 0;

        // 4. Check if current user is following this profile
        let isFollowing = false;
        if (currentUserId && followerData) {
            isFollowing = !!followerData[currentUserId as string];
        }

        const profile = {
            userId: userId,
            username: userData?.username || `@${userId}`,
            displayName: userData?.displayName || 'User',
            photoURL: userData?.photoURL || (userVideos[0]?.userPhoto) || 'https://i.pravatar.cc/150?u=anonymous',
            following: followingCount,
            followers: followersCount,
            likes: totalReceivedLikes,
            bio: userData?.bio || 'Toko Creator 🎥',
            isFollowing: isFollowing,
            posts: userVideos.reverse()
        };
        res.json(profile);
    } catch (error) {
        console.error('getProfile error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};

export const getInbox = async (req: Request, res: Response) => {
    res.json({ activities: [] });
};

export const searchUsers = async (req: Request, res: Response) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const term = (q as string).toLowerCase();
        console.log('[SEARCH-API] Searching for:', term);

        // Fetch all users
        const allUsers = await firebaseFetch('users');
        if (!allUsers) return res.json([]);

        // Fetch all followers to calculate counts
        const allFollowers = await firebaseFetch('followers') || {};

        const results = await Promise.all(Object.keys(allUsers)
            .map(async (uid) => {
                const user = allUsers[uid];

                // Calculate follower count
                const followersObj = allFollowers[uid] || {};
                const followerCount = Object.keys(followersObj).length;

                return {
                    uid,
                    ...user,
                    type: 'user',
                    text: user.username || `@${uid}`,
                    subtext: user.displayName || 'User',
                    avatar: user.photoURL || 'https://i.pravatar.cc/150?u=' + uid,
                    followerCount: followerCount,
                    likeCount: 0 // Placeholder for now, could be aggregated
                };
            }));

        const filtered = results.filter(u =>
            u.text.toLowerCase().includes(term) ||
            u.subtext.toLowerCase().includes(term)
        )
            .slice(0, 10);

        res.json(filtered);
    } catch (e) {
        console.error('[SEARCH-API] Error:', e);
        res.status(500).json({ message: 'Search failed' });
    }
};

export const searchVideos = async (req: Request, res: Response) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const term = (q as string).toLowerCase();
        const data = await firebaseFetch('videos');
        if (!data) return res.json([]);

        const results = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(v =>
                v.description?.toLowerCase().includes(term) ||
                v.creator?.toLowerCase().includes(term) ||
                v.soundName?.toLowerCase().includes(term)
            )
            .slice(0, 20);

        res.json(results);
    } catch (e) {
        console.error('[SEARCH-VIDEOS-API] Error:', e);
        res.status(500).json({ message: 'Video search failed' });
    }
};

export const deleteVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // 1. Fetch video to verify ownership
        const video = await firebaseFetch(`videos/${id}`);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        if (video.userId !== userId) {
            return res.status(403).json({ message: 'You can only delete your own videos' });
        }

        console.log(`[DELETE-VIDEO-API] Deleting video ${id} by user ${userId}`);

        // 2. Delete video metadata
        await firebaseFetch(`videos/${id}`, { method: 'DELETE' });

        // 3. Delete associated comments
        await firebaseFetch(`comments/${id}`, { method: 'DELETE' });

        // 4. Delete associated likes
        await firebaseFetch(`video_likes/${id}`, { method: 'DELETE' });

        res.json({ success: true, message: 'Video deleted successfully' });
    } catch (e) {
        console.error('[DELETE-VIDEO-API] Error:', e);
        res.status(500).json({ message: 'Error deleting video' });
    }
};

export const getVideosBySound = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = await firebaseFetch('videos');
        if (!data) return res.json([]);

        const videos = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(v => v.soundId === id || v.title?.includes(id)); // Flexible fallback

        res.json(videos.reverse());
    } catch (e) {
        console.error('[SOUND-VIDEOS-API] Error:', e);
        res.status(500).json({ message: 'Error fetching videos for sound' });
    }
};
