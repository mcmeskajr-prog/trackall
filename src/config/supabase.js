import { createClient } from '@supabase/supabase-js';

// ── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://kgclapivcpjqxbtomaue.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YhoOLoNbQda5iWgCUjLPvQ_HoO4uZ4B';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Wrapper ─────────────────────────────────────────────────────────────────
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
    const { data } = await supabase.from('library').select('media_id, data').eq('user_id', userId);
    if (!data) return {};
    const lib = {};
    data.forEach(row => { lib[row.media_id] = row.data; });
    return lib;
  },

  async upsertLibraryItem(userId, mediaId, data) {
    await supabase.from('library').upsert({ user_id: userId, media_id: mediaId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,media_id' });
  },

  async deleteLibraryItem(userId, mediaId) {
    await supabase.from('library').delete().eq('user_id', userId).eq('media_id', mediaId);
  },

  async updateFavorites(userId, favorites) {
    await supabase.from('profiles').update({ favorites }).eq('id', userId);
  },

  async updateUsername(userId, username) {
    await supabase.from('profiles').update({ username }).eq('id', userId);
  },

  // ─── Friends ───
  async searchUsers(query) {
    const { data } = await supabase.from('profiles')
      .select('id, name, username, avatar')
      .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(10);
    return data || [];
  },

  async sendFriendRequest(requesterId, addresseeId) {
    const { error } = await supabase.from('friendships').insert({ requester_id: requesterId, addressee_id: addresseeId });
    if (error) throw new Error(error.message);
  },

  async acceptFriendRequest(friendshipId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  },

  async declineFriendRequest(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
  },

  async removeFriend(requesterId, addresseeId) {
    await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`);
  },

  async getFriendships(userId) {
    const { data } = await supabase.from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (!data || data.length === 0) return [];
    const userIds = [...new Set(data.flatMap(f => [f.requester_id, f.addressee_id]).filter(id => id !== userId))];
    const { data: profiles } = await supabase.from('profiles')
      .select('id, name, username, avatar')
      .in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
    return data.map(f => ({
      ...f,
      requester: profileMap[f.requester_id] || { id: f.requester_id, name: "Utilizador", username: "", avatar: "" },
      addressee: profileMap[f.addressee_id] || { id: f.addressee_id, name: "Utilizador", username: "", avatar: "" },
    }));
  },

  async getFriendLibrary(userId) {
    const { data } = await supabase.from('library').select('media_id, data').eq('user_id', userId);
    if (!data) return {};
    const lib = {};
    data.forEach(row => { lib[row.media_id] = row.data; });
    return lib;
  },

  async getFriendProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  },

  // ─── Tier Lists ───
  async getPopularTierlists(limit = 10) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('tierlists')
      .select('*, profiles(name, username, avatar)')
      .gte('created_at', since)
      .order('likes_count', { ascending: false })
      .limit(limit);
    return data || [];
  },

  async getUserTierlists(userId) {
    const { data } = await supabase.from('tierlists')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  },

  async createTierlist(userId, title, tiers) {
    const { data, error } = await supabase.from('tierlists')
      .insert({ user_id: userId, title, tiers }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateTierlist(id, title, tiers) {
    const { error } = await supabase.from('tierlists').update({ title, tiers }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteTierlist(id) {
    await supabase.from('tierlists').delete().eq('id', id);
  },

  async toggleTierlistLike(userId, tierlistId) {
    const { data: existing } = await supabase.from('tierlist_likes')
      .select('id').eq('user_id', userId).eq('tierlist_id', tierlistId).single();
    if (existing) {
      await supabase.from('tierlist_likes').delete().eq('id', existing.id);
      const { data: tl } = await supabase.from('tierlists').select('likes_count').eq('id', tierlistId).single();
      await supabase.from('tierlists').update({ likes_count: Math.max(0, (tl?.likes_count || 1) - 1) }).eq('id', tierlistId);
      return false;
    } else {
      await supabase.from('tierlist_likes').insert({ user_id: userId, tierlist_id: tierlistId });
      const { data: tl } = await supabase.from('tierlists').select('likes_count').eq('id', tierlistId).single();
      await supabase.from('tierlists').update({ likes_count: (tl?.likes_count || 0) + 1 }).eq('id', tierlistId);
      return true;
    }
  },

  async getUserLikes(userId) {
    const { data } = await supabase.from('tierlist_likes').select('tierlist_id').eq('user_id', userId);
    return (data || []).map(r => r.tierlist_id);
  },

  // ─── Collections ───
  async getUserCollections(userId) {
    const { data } = await supabase.from('collections')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  },

  async createCollection(userId, { title, description, visibility, show_numbers, items }) {
    const { data, error } = await supabase.from('collections')
      .insert({ user_id: userId, title, description, visibility, show_numbers, items }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateCollection(id, { title, description, visibility, show_numbers, items }) {
    const { error } = await supabase.from('collections')
      .update({ title, description, visibility, show_numbers, items }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteCollection(id) {
    await supabase.from('collections').delete().eq('id', id);
  },

  async toggleCollectionLike(userId, collectionId) {
    const { data: existing } = await supabase.from('collection_likes')
      .select('user_id').eq('user_id', userId).eq('collection_id', collectionId).single();
    if (existing) {
      await supabase.from('collection_likes').delete().eq('user_id', userId).eq('collection_id', collectionId);
      const { data: cl } = await supabase.from('collections').select('likes_count').eq('id', collectionId).single();
      await supabase.from('collections').update({ likes_count: Math.max(0, (cl?.likes_count || 1) - 1) }).eq('id', collectionId);
      return false;
    } else {
      await supabase.from('collection_likes').insert({ user_id: userId, collection_id: collectionId });
      const { data: cl } = await supabase.from('collections').select('likes_count').eq('id', collectionId).single();
      await supabase.from('collections').update({ likes_count: (cl?.likes_count || 0) + 1 }).eq('id', collectionId);
      return true;
    }
  },

  async getUserCollectionLikes(userId) {
    const { data } = await supabase.from('collection_likes').select('collection_id').eq('user_id', userId);
    return (data || []).map(r => r.collection_id);
  },
};

export { supabase, supa };