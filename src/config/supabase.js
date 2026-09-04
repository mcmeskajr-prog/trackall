import { createClient } from '@supabase/supabase-js';

// ─── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://kgclapivcpjqxbtomaue.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YhoOLoNbQda5iWgCUjLPvQ_HoO4uZ4B';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Auth State Persistence ──────────────────────────────────────────────────
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    localStorage.setItem('supabase.auth.token', JSON.stringify(session));
  } else {
    localStorage.removeItem('supabase.auth.token');
  }
});

// ─── Wrapper ─────────────────────────────────────────────────────────────────
const supa = {
  _user: null,

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    supa._user = data.user;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    supa._user = data.user;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
    supa._user = null;
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      supa._user = data.session.user;
      return data.session.user;
    }
    return null;
  },

  async getProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  },

  async upsertProfile(userId, profileData) {
    await supabase.from('profiles').update({ ...profileData, updated_at: new Date().toISOString() }).eq('id', userId);
  },

  async getLibrary(userId) {
    const { data, error } = await supabase.from('library').select('media_id, data').eq('user_id', userId);
    if (error) { console.error('getLibrary error:', error); return {}; }
    const lib = {};
    (data || []).forEach(row => {
      if (row.media_id && row.media_id !== '__hall_of_fame__' && row.data) {
        lib[row.media_id] = { ...row.data, id: row.media_id };
      }
    });
    return lib;
  },

  async upsertLibraryItem(userId, mediaId, mediaData) {
    await supabase.from('library').upsert({ user_id: userId, media_id: mediaId, data: mediaData, updated_at: new Date().toISOString() });
  },

  async deleteLibraryItem(userId, mediaId) {
    await supabase.from('library').delete().eq('user_id', userId).eq('media_id', mediaId);
  },

  async updateFavorites(userId, favorites) {
    await supabase.from('profiles').update({ favorites }).eq('id', userId);
  },

  async searchUsers(query) {
    const { data } = await supabase.from('profiles').select('id, username, avatar_url').ilike('username', `%${query}%`).limit(10);
    return data;
  },

  async sendFriendRequest(fromUserId, toUserId) {
    await supabase.from('friend_requests').insert({ from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' });
  },

  async acceptFriendRequest(requestId) {
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
  },

  async declineFriendRequest(requestId) {
    await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', requestId);
  },

  async removeFriend(userId, friendId) {
    await supabase.from('friendships').delete().or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`);
  },

  async getFriendships(userId) {
    const { data, error } = await supabase.from('friendships').select('*').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error) { console.error('getFriendships error:', error); return []; }
    return data || [];
  },

  async getFriendLibrary(friendId) {
    const { data } = await supabase.from('library').select('media_id, data').eq('user_id', friendId);
    return data;
  },

  async getFriendProfile(friendId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', friendId).single();
    return data;
  },

  async getPopularTierlists() {
    const { data } = await supabase.from('tierlists').select('*').order('likes_count', { ascending: false }).limit(20);
    return data;
  },

  async getUserTierlists(userId) {
    const { data } = await supabase.from('tierlists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data;
  },

  async createTierlist(userId, tierlistData) {
    const { data } = await supabase.from('tierlists').insert({ user_id: userId, ...tierlistData, created_at: new Date().toISOString() }).select().single();
    return data;
  },

  async updateTierlist(tierlistId, tierlistData) {
    await supabase.from('tierlists').update({ ...tierlistData, updated_at: new Date().toISOString() }).eq('id', tierlistId);
  },

  async deleteTierlist(tierlistId) {
    await supabase.from('tierlists').delete().eq('id', tierlistId);
  },

  async toggleTierlistLike(userId, tierlistId) {
    const { data: existing } = await supabase.from('tierlist_likes').select('id').eq('user_id', userId).eq('tierlist_id', tierlistId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('tierlist_likes').delete().eq('id', existing.id);
      if (!error) await supabase.from('tierlists').update({ likes_count: supabase.rpc('decrement_likes', { tierlist_id: tierlistId }) }).eq('id', tierlistId);
      return false;
    } else {
      const { error } = await supabase.from('tierlist_likes').insert({ user_id: userId, tierlist_id: tierlistId });
      if (!error) await supabase.from('tierlists').update({ likes_count: supabase.rpc('increment_likes', { tierlist_id: tierlistId }) }).eq('id', tierlistId);
      return true;
    }
  },

  async getUserLikes(userId) {
    const { data } = await supabase.from('tierlist_likes').select('tierlist_id').eq('user_id', userId);
    return data;
  },

  async getUserCollections(userId) {
    const { data } = await supabase.from('collections').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data;
  },

  async createCollection(userId, collectionData) {
    const { data } = await supabase.from('collections').insert({ user_id: userId, ...collectionData, created_at: new Date().toISOString() }).select().single();
    return data;
  },

  async updateCollection(collectionId, collectionData) {
    await supabase.from('collections').update({ ...collectionData, updated_at: new Date().toISOString() }).eq('id', collectionId);
  },

  async deleteCollection(collectionId) {
    await supabase.from('collections').delete().eq('id', collectionId);
  },

  async toggleCollectionLike(userId, collectionId) {
    const { data: existing } = await supabase.from('collection_likes').select('*').eq('user_id', userId).eq('collection_id', collectionId).single();
    if (existing) {
      await supabase.from('collection_likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('collection_likes').insert({ user_id: userId, collection_id: collectionId });
    }
  },

  async getUserCollectionLikes(userId) {
    const { data } = await supabase.from('collection_likes').select('collection_id').eq('user_id', userId);
    return data;
  }
};

export { supabase, supa };