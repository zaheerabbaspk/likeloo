import { getFeed, likeVideo, trackView, getProfile, getInbox, uploadVideo, upload, getLikedVideos, followUser, getFollowingContent, addComment, getComments, searchUsers, likeComment, addReply, getReplies, deleteVideo, getVideosBySound, searchVideos } from '../controllers/video.controller';
import { Router } from 'express';

const router = Router();
console.log('Registering Video Routes...');

router.get('/feed', getFeed);
router.get('/following', getFollowingContent);
router.get('/profile', getProfile);
router.get('/inbox', getInbox);
router.post('/upload', upload.single('video'), uploadVideo);
router.post('/like/:id', likeVideo);
router.post('/view/:id', trackView);
router.get('/liked', getLikedVideos);
router.post('/follow', followUser);
router.get('/users/search', searchUsers);
router.get('/comments/:id', getComments);
router.post('/comment/:id', addComment);
router.post('/comment/:videoId/like/:commentId', likeComment);
router.post('/comment/:videoId/reply/:commentId', addReply);
router.get('/comments/replies/:commentId', getReplies);
router.post('/video/:id', deleteVideo);
router.get('/sound/:id', getVideosBySound);
router.get('/search', searchVideos);

export default router;
