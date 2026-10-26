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
// Só as colunas que o perfil de um amigo precisa (nunca `select *`: ver profile_private)
const FRIEND_PROFILE_COLS = 'id, name, bio, avatar, banner, accent, username, favorites, bg_color, bg_image, bg_overlay, bg_blur, bg_parallax, bg_separate_devices, bg_color_mobile, hide_banner_mobile, panel_bg, panel_opacity, sidebar_color';

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

  // Campos privados (chaves/URLs pessoais) vivem em `profile_private` (RLS: só o próprio). `profiles` é legível por outros utilizadores.
  async getProfile(userId) {
    const [{ data }, { data: priv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('profile_private').select('tmdb_key, worker_url, drive_client_id').eq('id', userId).maybeSingle(),
    ]);
    return data ? { ...data, ...(priv || {}) } : data;
  },

  async upsertProfile(userId, profileData) {
    const PRIVATE = ['tmdb_key', 'worker_url', 'drive_client_id'];
    const pub = {}, priv = {};
    Object.keys(profileData || {}).forEach(k => { (PRIVATE.includes(k) ? priv : pub)[k] = profileData[k]; });
    if (Object.keys(priv).length) {
      const { error } = await supabase.from('profile_private').upsert({ id: userId, ...priv, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    if (Object.keys(pub).length) {
      await supabase.from('profiles').update({ ...pub, updated_at: new Date().toISOString() }).eq('id', userId);
    }
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
    const row = { user_id: userId, media_id: mediaId, data: mediaData, updated_at: new Date().toISOString() };
    // 1.º tentativa: upsert por (user_id, media_id)
    const first = await supabase.from('library').upsert(row, { onConflict: 'user_id,media_id' });
    if (!first.error) return;
    console.warn('[TrackAll] upsert falhou, a tentar update/insert:', first.error.message || first.error);
    // Plano B (não depende de constraints): atualiza a linha; se não existir, insere
    const upd = await supabase.from('library').update({ data: mediaData, updated_at: row.updated_at }).eq('user_id', userId).eq('media_id', mediaId).select('media_id');
    if (upd.error) throw upd.error;
    if (!upd.data || upd.data.length === 0) {
      const ins = await supabase.from('library').insert(row);
      if (ins.error) throw ins.error;
    }
  },

  async deleteLibraryItem(userId, mediaId) {
    const { error } = await supabase.from('library').delete().eq('user_id', userId).eq('media_id', mediaId);
    if (error) throw error;
  },

  async updateFavorites(userId, favorites) {
    await supabase.from('profiles').update({ favorites }).eq('id', userId);
  },

  // ── Amigos ─────────────────────────────────────────────────────────────────
  // Tabela única: friendships { id, requester_id, addressee_id, status: 'pending'|'accepted'|'declined' }.
  // (As antigas funções em 'friend_requests' escreviam numa tabela que nada lia — pedidos nunca apareciam.)
  // Perfil "leve" de uma pessoa (sem imagens de fundo): é o que as listas e o feed precisam.
  async _lightProfiles(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return {};
    let { data, error } = await supabase.from('profiles').select('id, username, name, avatar, accent').in('id', uniq);
    if (error) { // coluna em falta? tenta o mínimo
      console.warn('profiles (leve) falhou, a tentar o mínimo:', error.message);
      ({ data } = await supabase.from('profiles').select('id, username, name, avatar').in('id', uniq));
    }
    const map = {};
    (data || []).forEach(p => { map[p.id] = p; });
    return map;
  },

  async searchUsers(query) {
    const q = String(query || '').trim().replace(/[%,()]/g, ' ');
    if (!q) return [];
    const { data, error } = await supabase.from('profiles').select('id, username, name, avatar, accent')
      .or(`username.ilike.%${q}%,name.ilike.%${q}%`).limit(12);
    if (error) { console.error('searchUsers error:', error); throw new Error(error.message); }
    return data || [];
  },

  async sendFriendRequest(fromUserId, toUserId) {
    const { error } = await supabase.from('friendships').insert({ requester_id: fromUserId, addressee_id: toUserId, status: 'pending' });
    if (error) throw new Error(error.message);
  },

  async acceptFriendRequest(requestId) {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
    if (error) throw new Error(error.message);
  },

  async declineFriendRequest(requestId) {
    // recusar = apagar a linha (assim a pessoa pode voltar a pedir mais tarde)
    const { error } = await supabase.from('friendships').delete().eq('id', requestId);
    if (error) throw new Error(error.message);
  },

  async removeFriend(userId, friendId) {
    const { error } = await supabase.from('friendships').delete().or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`);
    if (error) throw new Error(error.message);
  },

  // Devolve as linhas de friendships já com { requester, addressee } (perfis leves) — mesma forma que o FriendsView espera.
  async getFriendships(userId) {
    const { data, error } = await supabase.from('friendships').select('*').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error) { console.error('getFriendships error:', error); throw new Error(error.message); }
    const rows = data || [];
    const profs = await supa._lightProfiles(rows.flatMap(r => [r.requester_id, r.addressee_id]));
    return rows.map(r => ({
      ...r,
      requester: profs[r.requester_id] || { id: r.requester_id },
      addressee: profs[r.addressee_id] || { id: r.addressee_id },
    }));
  },

  // Biblioteca de um amigo no MESMO formato da nossa: { [media_id]: item }. Nunca o array de linhas cru,
  // e sem as linhas especiais (ids que começam por "__").
  async getFriendLibrary(friendId) {
    const { data, error } = await supabase.from('library').select('media_id, data').eq('user_id', friendId);
    if (error) { console.error('getFriendLibrary error:', error); throw new Error(error.message); }
    const lib = {};
    (data || []).forEach(row => { if (row.media_id && !row.media_id.startsWith('__') && row.data) lib[row.media_id] = { ...row.data, id: row.media_id }; });
    return lib;
  },

  // Hall of Fame de um amigo: { hall: [], featured: item|null } (linha especial "__hall_of_fame__")
  async getFriendHall(friendId) {
    const { data } = await supabase.from('library').select('data').eq('user_id', friendId).eq('media_id', '__hall_of_fame__').maybeSingle();
    const d = data?.data || {};
    return { hall: Array.isArray(d.hall) ? d.hall : [], featured: d.featured || null };
  },

  async getFriendProfile(friendId) {
    const { data, error } = await supabase.from('profiles').select(FRIEND_PROFILE_COLS).eq('id', friendId).maybeSingle();
    if (error) { console.error('getFriendProfile error:', error); throw new Error(error.message); }
    return data;
  },

  // Tudo o que o perfil de um amigo precisa, em paralelo
  async getFriendData(friendId) {
    const [profile, library, hallRow] = await Promise.all([
      supa.getFriendProfile(friendId),
      supa.getFriendLibrary(friendId),
      supa.getFriendHall(friendId).catch(() => ({ hall: [], featured: null })),
    ]);
    const hall = hallRow.hall.length ? hallRow.hall : (Array.isArray(profile?.hall_of_fame) ? profile.hall_of_fame : []);
    return { profile, library, hall, featured: hallRow.featured };
  },

  // Atividade recente de vários amigos numa só consulta (só campos leves, só "completo"/"assistindo",
  // mais recentes primeiro). Se o servidor não aceitar a ordenação/filtro por JSON, faz um fallback simples.
  async getFriendsActivity(friendIds, limit = 150) {
    const ids = [...new Set(friendIds || [])];
    if (!ids.length) return [];
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const clean = (r) => ({
      id: r.media_id, userId: r.user_id, title: r.title || '', type: r.type || '',
      cover: r.cover || null, thumbnailUrl: r.thumb || null,
      customCover: r.customCover && !String(r.customCover).startsWith('data:') ? r.customCover : null,
      userStatus: r.userStatus || '', userRating: num(r.userRating), addedAt: num(r.addedAt),
    });
    const cols = "media_id, user_id, title:data->>title, type:data->>type, cover:data->>cover, thumb:data->>thumbnailUrl, customCover:data->>customCover, userStatus:data->>userStatus, userRating:data->>userRating, addedAt:data->>addedAt";
    let { data, error } = await supabase.from('library').select(cols)
      .in('user_id', ids).neq('media_id', '__hall_of_fame__')
      .in('data->>userStatus', ['completo', 'assistindo'])
      .order('data->>addedAt', { ascending: false }).limit(limit);
    if (error) {
      console.warn('getFriendsActivity: consulta otimizada falhou, a usar fallback —', error.message);
      const res = await supabase.from('library').select(cols).in('user_id', ids).neq('media_id', '__hall_of_fame__').limit(1500);
      if (res.error) throw new Error(res.error.message);
      data = (res.data || []).filter(r => r.userStatus === 'completo' || r.userStatus === 'assistindo');
    }
    return (data || []).map(clean).filter(i => i.addedAt && i.title).sort((a, b) => b.addedAt - a.addedAt).slice(0, limit);
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
  },

  // Envia uma imagem (Blob) para o Storage e devolve o URL público curto,
  // em vez de guardarmos a imagem toda como texto base64 na base de dados
  // (isso é o que fazia o guardar do banner/avatar encravar).
  async uploadImage(userId, blob, filename) {
    const path = `${userId}/${filename}`;
    const { error } = await supabase.storage.from('profile-images').upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
    return data.publicUrl;
  }
};

export { supabase, supa };