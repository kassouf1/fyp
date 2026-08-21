import client from './client';

export interface UserCard {
  userId: number;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  isFollowedByMe: boolean;
  followsMe: boolean;
}

export interface SharedFollower {
  username: string;
  fullName: string;
}

export interface UserProfile extends UserCard {
  postCount: number;
  followerCount: number;
  followingCount: number;
  friendCount: number;
  sharedFollowers: SharedFollower[];
  sharedFollowerCount: number;
}

export interface PostDto {
  id: number;
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  imageUrl: string;
  caption: string;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  createdAt: string;
}

export interface CommentDto {
  id: number;
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  text: string;
  createdAt: string;
}

export interface StoryItem {
  id: number;
  imageUrl: string;
  caption: string | null;
  postId: number | null;
  postAuthorName: string | null;
  postAuthorAvatarUrl: string | null;
  postCaption: string | null;
  createdAt: string;
  expiresAt: string;
  isViewed: boolean;
  viewCount: number;
  likeCount: number;
  isLikedByMe: boolean;
}

export interface StoryViewerDto {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  hasLiked: boolean;
}

export interface StoryGroup {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  hasUnviewed: boolean;
  stories: StoryItem[];
}

export interface ConversationDto {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageRequestDto {
  id: number;
  senderId: number;
  senderName: string;
  senderAvatar: string | null;
  messageText: string;
  mediaUrl: string | null;
  createdAt: string;
}

export interface MessageDto {
  id: number;
  senderId: number;
  text: string;
  storyImageUrl: string | null;
  mediaUrl: string | null;
  postId: number | null;
  postImageUrl: string | null;
  postAuthorName: string | null;
  postAuthorAvatarUrl: string | null;
  postCaption: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationDto {
  id: number;
  type: 'like' | 'comment' | 'follow' | 'repost' | 'tag';
  actorId: number;
  actorName: string;
  actorAvatar: string | null;
  postId: number | null;
  commentText: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SuggestedUser {
  userId: number;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  followerCount: number;
  mutualFollow: boolean;
  isFollowedByMe: boolean;
  followsMe: boolean;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const searchUsers = (q: string, requesterId: number) =>
  client.get<UserCard[]>('/users/search', { params: { q, requesterId } }).then(r => r.data);

export const getSuggestedUsers = (userId: number) =>
  client.get<SuggestedUser[]>(`/users/${userId}/suggestions`).then(r => r.data);

export const getUserProfile = (userId: number, requesterId: number) =>
  client.get<UserProfile>(`/users/${userId}/profile`, { params: { requesterId } }).then(r => r.data);

export const updateAvatar = (userId: number, avatarUrl: string | null) =>
  client.put(`/users/${userId}/avatar`, { avatarUrl }).then(r => r.data);

// ── Posts ─────────────────────────────────────────────────────────────────────
export const createPost = (userId: number, imageUrl: string, caption: string, taggedUserIds?: number[]) =>
  client.post<PostDto>('/posts', { userId, imageUrl, caption, taggedUserIds: taggedUserIds ?? [] }).then(r => r.data);

export const getFeed = (userId: number, page = 0) =>
  client.get<PostDto[]>('/posts/feed', { params: { userId, page } }).then(r => r.data);

// Unlike /feed (following-only), /explore returns recent posts from
// everyone — this powers the Discover grid.
export const getExplorePosts = (userId: number, page = 0) =>
  client.get<PostDto[]>('/posts/explore', { params: { userId, page } }).then(r => r.data);

export const getUserPosts = (userId: number, requesterId: number) =>
  client.get<PostDto[]>(`/posts/user/${userId}`, { params: { requesterId } }).then(r => r.data);

export const updatePost = (postId: number, userId: number, caption: string) =>
  client.put<PostDto>(`/posts/${postId}`, { userId, caption }).then(r => r.data);

export const deletePost = (postId: number, userId: number) =>
  client.delete(`/posts/${postId}`, { params: { userId } });

export const repostPost = (postId: number, userId: number) =>
  client.post<PostDto>(`/posts/${postId}/repost`, { userId }).then(r => r.data);

export const toggleLike = (postId: number, userId: number) =>
  client.post<{ liked: boolean; likeCount: number }>(`/posts/${postId}/like`, { userId }).then(r => r.data);

export const getComments = (postId: number) =>
  client.get<CommentDto[]>(`/posts/${postId}/comments`).then(r => r.data);

export const addComment = (postId: number, userId: number, text: string) =>
  client.post<CommentDto>(`/posts/${postId}/comments`, { userId, text }).then(r => r.data);

export const deleteComment = (postId: number, commentId: number, userId: number) =>
  client.delete(`/posts/${postId}/comments/${commentId}`, { params: { userId } });

// ── Stories ───────────────────────────────────────────────────────────────────
export const createStory = (
  userId: number, imageUrl: string, caption?: string, postId?: number,
  postAuthorName?: string, postAuthorAvatarUrl?: string | null, postCaption?: string,
) =>
  client.post('/stories', { userId, imageUrl, caption, postId, postAuthorName, postAuthorAvatarUrl, postCaption }).then(r => r.data);

export const getFeedStories = (userId: number) =>
  client.get<StoryGroup[]>('/stories/feed', { params: { userId } }).then(r => r.data);

export const markStoryViewed = (storyId: number, userId: number) =>
  client.post(`/stories/${storyId}/view`, { userId });

export const likeStory = (storyId: number, userId: number) =>
  client.post<{ liked: boolean; likeCount: number }>(`/stories/${storyId}/like`, { userId }).then(r => r.data);

export const getStoryViewers = (storyId: number, userId: number) =>
  client.get<StoryViewerDto[]>(`/stories/${storyId}/viewers`, { params: { userId } }).then(r => r.data);

export const deleteStory = (storyId: number, userId: number) =>
  client.delete(`/stories/${storyId}`, { params: { userId } });

// ── Follow ────────────────────────────────────────────────────────────────────
export const followUser = (followerId: number, followingId: number) =>
  client.post<{ following: boolean }>('/social/follow', { followerId, followingId }).then(r => r.data);

export const unfollowUser = (followerId: number, followingId: number) =>
  client.delete<{ following: boolean }>('/social/follow', { params: { followerId, followingId } }).then(r => r.data);

export const getFollowers = (userId: number, requesterId: number) =>
  client.get<UserCard[]>(`/social/${userId}/followers`, { params: { requesterId } }).then(r => r.data);

export const getFollowing = (userId: number, requesterId: number) =>
  client.get<UserCard[]>(`/social/${userId}/following`, { params: { requesterId } }).then(r => r.data);

// A "friend" is a mutual follow — userId follows them and they follow back.
export const getFriends = (userId: number, requesterId: number) =>
  client.get<UserCard[]>(`/social/${userId}/friends`, { params: { requesterId } }).then(r => r.data);

// ── Chat ──────────────────────────────────────────────────────────────────────
export const getConversations = (userId: number) =>
  client.get<ConversationDto[]>('/chats/conversations', { params: { userId } }).then(r => r.data);

export const getMessages = (userId: number, partnerId: number, page = 0) =>
  client.get<MessageDto[]>('/chats/messages', { params: { userId, partnerId, page } }).then(r => r.data);

export const sendMessage = (
  senderId: number, receiverId: number, text: string,
  storyImageUrl?: string, mediaUrl?: string,
  postId?: number, postImageUrl?: string,
  postAuthorName?: string, postAuthorAvatarUrl?: string, postCaption?: string,
) =>
  client.post<MessageDto>('/chats/messages', {
    senderId, receiverId, text, storyImageUrl, mediaUrl,
    postId, postImageUrl, postAuthorName, postAuthorAvatarUrl, postCaption,
  }).then(r => r.data);

export const getPost = (postId: number, requesterId: number) =>
  client.get<PostDto>(`/posts/${postId}`, { params: { requesterId } }).then(r => r.data);

export const getMessageRequests = (userId: number) =>
  client.get<MessageRequestDto[]>('/chats/requests', { params: { userId } }).then(r => r.data);

export const acceptMessageRequest = (requestId: number, userId: number) =>
  client.post(`/chats/requests/${requestId}/accept`, null, { params: { userId } }).then(r => r.data);

export const rejectMessageRequest = (requestId: number, userId: number) =>
  client.post(`/chats/requests/${requestId}/reject`, null, { params: { userId } }).then(r => r.data);

// ── Block ──────────────────────────────────────────────────────────────────────
export const blockUser = (blockerId: number, blockedId: number) =>
  client.post<{ blocked: boolean }>('/users/block', { blockerId, blockedId }).then(r => r.data);

export const unblockUser = (blockerId: number, blockedId: number) =>
  client.delete<{ blocked: boolean }>('/users/block', { params: { blockerId, blockedId } }).then(r => r.data);

export const isUserBlocked = (userId: number, requesterId: number) =>
  client.get<{ blocked: boolean }>(`/users/${userId}/is-blocked`, { params: { requesterId } }).then(r => r.data.blocked);

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = (userId: number) =>
  client.get<NotificationDto[]>('/notifications', { params: { userId } }).then(r => r.data);

export const markAllNotificationsRead = (userId: number) =>
  client.post('/notifications/read-all', null, { params: { userId } });

export const getUnreadNotificationCount = (userId: number) =>
  client.get<{ count: number }>('/notifications/unread-count', { params: { userId } }).then(r => r.data.count);

export const deleteMessage = (messageId: number, userId: number) =>
  client.delete(`/chats/messages/${messageId}`, { params: { userId } });

export const editMessage = (messageId: number, userId: number, text: string) =>
  client.patch<{ id: number; text: string }>(`/chats/messages/${messageId}`, { userId, text }).then(r => r.data);
