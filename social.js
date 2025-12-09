// Social feed with strict profanity enforcement (auto-strike + delete).
// Image upload removed. Owners can hide/delete their own posts (status -> hidden).
import { auth, db, waitForAuth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  ref, push, set, onValue, update, query, limitToLast, child, get, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const $ = (sel) => document.querySelector(sel);
const pages = document.querySelectorAll('[data-page]');
const feedPage = $('#feedSection');
const composePage = $('#composeSection');
const detailPage = $('#detailSection');

const postListEl = $('#postList');
const emptyStateEl = $('#emptyState');
const detailTitle = $('#detailTitle');
const detailMeta = $('#detailMeta');
const detailBody = $('#detailBody');
const detailImages = $('#detailImages');
const postLikeCountEl = $('#postLikeCount');
const commentList = $('#commentList');
const commentEmpty = $('#commentEmpty');
const commentHint = $('#commentHint');
const reportPostBtn = $('#reportPostBtn');
const likePostBtn = $('#likePostBtn');
const deletePostBtn = $('#deletePostBtn');
const postForm = $('#postForm');
const postFormHint = $('#postFormHint');
const commentForm = $('#commentForm');
const userStatus = $('#userStatus');
const fabNewPost = $('#fabNewPost');
const backToFeedBtn = $('#backToFeed');
const cancelComposeBtn = $('#cancelCompose');

const reportOverlay = $('#reportOverlay');
const reportTargetInfo = $('#reportTargetInfo');
const reportReason = $('#reportReason');
const reportSubmit = $('#reportSubmit');
const reportCancel = $('#reportCancel');

const displayNameInput = $('#displayNameInput');
const saveDisplayName = $('#saveDisplayName');
const logoutBtn = $('#logoutBtn');

let currentUser = null;
let currentDetailPost = null;
let postsCache = {};
let inboxUnsub = null;
let pendingReport = null; // { targetType, postId, commentId, authorUid }

const BANNED_WORDS = [
  "nigger","nigga","fuck","fucking","shit","bitch","cunt","slut","whore","faggot",
  "chink","kike","spic","retard","asshole"
];
const REPORT_THRESHOLD = 3;

// Navigation
function showPage(pageEl) {
  pages.forEach(p => { if (p) p.style.display = 'none'; });
  if (pageEl) pageEl.style.display = 'block';
}
fabNewPost?.addEventListener('click', () => showPage(composePage));
cancelComposeBtn?.addEventListener('click', () => showPage(feedPage));
backToFeedBtn?.addEventListener('click', () => showPage(feedPage));

// Auth
logoutBtn?.addEventListener('click', async ()=>{ if (!auth) return; const { signOut } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"); await signOut(auth); location.href="index.html"; });

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    userStatus.textContent = 'Nav pieslēgts';
    disableCompose();
    unsubscribeInbox();
    return;
  }
  userStatus.textContent = user.email || user.displayName || 'Pieslēgts';
  const status = await getUserStatus(user.uid);
  if (status.banned) lockPosting(`Tu esi bloķēts (strikes: ${status.strikes || 0}).`);
  preloadDisplayName(user.uid);
  subscribeInbox(user.uid);
});

async function getUserStatus(uid) {
  const snap = await get(child(ref(db), `users/${uid}`));
  const val = snap.exists() ? snap.val() : {};
  const now = Date.now();
  const bannedUntil = val.bannedUntil || null;
  const expired = bannedUntil && now > bannedUntil;
  if (expired) {
    await update(ref(db), { [`users/${uid}/banned`]: false, [`users/${uid}/bannedUntil`]: null });
  }
  return { strikes: val.strikes || 0, banned: expired ? false : !!val.banned, bannedUntil };
}

function lockPosting(msg) {
  postForm.querySelector('button').disabled = true;
  commentForm.querySelector('button').disabled = true;
  postFormHint.textContent = msg;
}
function disableCompose() {
  postForm.querySelector('button').disabled = true;
  commentForm.querySelector('button').disabled = true;
}

// Helpers
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'tikko';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
function containsBannedWords(text) {
  if (!text) return false;
  const lowered = text.toLowerCase();
  return BANNED_WORDS.some(w => lowered.includes(w));
}
async function addStrike(uid, reason) {
  const snap = await get(ref(db, `users/${uid}/strikes`));
  const cur = snap.exists() ? Number(snap.val()) : 0;
  await update(ref(db), {
    [`users/${uid}/strikes`]: cur + 1,
    [`users/${uid}/lastStrikeReason`]: reason || "Policy violation"
  });
}

// Display name save
saveDisplayName?.addEventListener('click', async () => {
  if (!currentUser) return alert('Pieslēdzies.');
  const name = (displayNameInput.value || '').trim();
  if (!name) return alert('Ievadi vārdu.');
  await update(ref(db), { [`users/${currentUser.uid}/profile/displayName`]: name });
  alert('Saglabāts.');
});

async function preloadDisplayName(uid) {
  const snap = await get(ref(db, `users/${uid}/profile/displayName`));
  if (snap.exists()) {
    displayNameInput.value = snap.val() || '';
  }
}

// Feed rendering
function renderPosts() {
  const posts = Object.values(postsCache)
    .filter(p => p.status !== 'hidden')
    .sort((a, b) => b.createdAt - a.createdAt);

  postListEl.innerHTML = '';
  if (!posts.length) {
    emptyStateEl.style.display = 'block';
    return;
  }
  emptyStateEl.style.display = 'none';

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'goal-card';
    const img = (post.images && post.images[0]) ? `<div class="thumb" style="background-image:url('${post.images[0]}');"></div>` : '';
    card.innerHTML = `
      <div class="goal-head">
        <div>
          <div class="badge">${sanitize(post.title)}</div>
          <div class="small muted">${post.author?.name || 'Anon'} • ${relativeTime(post.createdAt)}</div>
        </div>
      </div>
      ${img}
      <p class="small" style="margin:8px 0 0; color:var(--muted);">Atvērt • ❤️ ${post.likesCount || 0}</p>
    `;
    card.addEventListener('click', () => openDetail(post.id));
    postListEl.appendChild(card);
  });
}

// Detail rendering
function renderDetail(post) {
  currentDetailPost = post;
  showPage(detailPage);
  detailTitle.textContent = post.title;
  detailMeta.textContent = `${post.author?.name || 'Anon'} • ${relativeTime(post.createdAt)}`;
  detailBody.textContent = post.body || '';
  postLikeCountEl.textContent = post.likesCount || 0;

  detailImages.innerHTML = '';
  (post.images || []).forEach(url => {
    const imgCard = document.createElement('div');
    imgCard.className = 'ad-card';
    imgCard.innerHTML = `<div class="ad-bg" style="background-image:url('${url}')"></div>`;
    detailImages.appendChild(imgCard);
  });

  if (currentUser && post.author?.uid === currentUser.uid) {
    deletePostBtn.style.display = 'inline-flex';
    deletePostBtn.onclick = () => handleDeletePost(post.id);
  } else {
    deletePostBtn.style.display = 'none';
    deletePostBtn.onclick = null;
  }

  // Wire report for post
  reportPostBtn.onclick = () => {
    if (!currentDetailPost) return;
    openReportOverlay({
      targetType: 'post',
      postId: currentDetailPost.id,
      commentId: null,
      authorUid: currentDetailPost.author?.uid || null
    });
  };

  loadComments(post.id);
}

// Data subscriptions
(function subscribePosts() {
  const postsRef = query(ref(db, 'posts'), limitToLast(100));
  onValue(postsRef, (snap) => {
    postsCache = {};
    snap.forEach(child => {
      const val = child.val();
      postsCache[child.key] = { id: child.key, likesCount: val.likesCount || 0, ...val };
    });
    renderPosts();
    if (currentDetailPost && postsCache[currentDetailPost.id]) {
      renderDetail(postsCache[currentDetailPost.id]);
    }
  });
})();

// Delete post (owner only) -> hide it (status=hidden)
async function handleDeletePost(postId) {
  if (!currentUser) return;
  const post = postsCache[postId];
  if (!post || post.author?.uid !== currentUser.uid) return;
  if (!confirm("Dzēst šo ierakstu?")) return;
  try {
    await update(ref(db), {
      [`posts/${postId}/status`]: 'hidden',
      [`posts/${postId}/title`]: '[Deleted]',
      [`posts/${postId}/body`]: '',
      [`posts/${postId}/images`]: [],
      [`posts/${postId}/deletedAt`]: Date.now(),
      [`posts/${postId}/deletedBy`]: currentUser.uid
    });
    alert("Ieraksts dzēsts.");
    showPage(feedPage);
  } catch (e) {
    alert("Neizdevās dzēst: " + (e?.message || e));
  }
}

// Post create
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert('Pieslēdzies.');
  const status = await getUserStatus(currentUser.uid);
  if (status.banned) return lockPosting('Tu esi bloķēts.');

  const title = postForm.title.value.trim();
  const body = postForm.body.value.trim();
  if (!title) return;

  const content = (title + " " + body).toLowerCase();
  if (containsBannedWords(content)) {
    await addStrike(currentUser.uid, "Banned words in post");
    postFormHint.textContent = 'Ieraksts dzēsts: aizliegta leksika (strike pievienots).';
    setTimeout(() => (postFormHint.textContent = ''), 3000);
    return;
  }

  const postRef = push(ref(db, 'posts'));
  const images = [];

  await set(postRef, {
    title,
    body,
    images,
    createdAt: Date.now(),
    status: 'visible',
    author: {
      uid: currentUser.uid,
      name: displayNameInput.value.trim() || currentUser.displayName || currentUser.email || 'Anon'
    },
    reports: 0,
    likesCount: 0
  });

  postForm.reset();
  postFormHint.textContent = 'Publicēts!';
  setTimeout(() => (postFormHint.textContent = ''), 2500);
  showPage(feedPage);
});

// Comments & replies
function renderCommentEl(postId, commentId, c) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  const isReply = !!c.parentId;
  div.style.marginLeft = isReply ? '16px' : '0';
  div.innerHTML = `
    <div class="meta">
      <span>${c.author?.name || 'Anon'}</span>
      <span>${relativeTime(c.createdAt)}</span>
    </div>
    <div class="text">${sanitize(c.body)}</div>
    <div class="actions">
      <button class="btn outline small" data-like>Patīk (${c.likesCount || 0})</button>
      <button class="btn outline small" data-reply>Atbildēt</button>
      <button class="btn outline small" data-report>Ziņot</button>
    </div>
  `;
  div.querySelector('[data-like]').onclick = () => toggleLikeComment(postId, commentId);
  div.querySelector('[data-report]').onclick = () => openReportOverlay({ targetType: 'comment', postId, commentId, authorUid: c.author?.uid || null });
  div.querySelector('[data-reply]').onclick = () => startReply(commentId, c);
  return div;
}

function loadComments(postId) {
  const commentsRef = ref(db, `comments/${postId}`);
  onValue(commentsRef, (snap) => {
    commentList.innerHTML = '';
    if (!snap.exists()) {
      commentEmpty.style.display = 'block';
      return;
    }
    commentEmpty.style.display = 'none';
    const all = {};
    snap.forEach(child => { all[child.key] = { id: child.key, ...child.val() }; });

    Object.values(all)
      .filter(c => !c.parentId)
      .sort((a,b)=>a.createdAt - b.createdAt)
      .forEach(c => {
        commentList.appendChild(renderCommentEl(postId, c.id, c));
        Object.values(all)
          .filter(r => r.parentId === c.id)
          .sort((a,b)=>a.createdAt - b.createdAt)
          .forEach(r => commentList.appendChild(renderCommentEl(postId, r.id, r)));
      });
  });
}

commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser || !currentDetailPost) return;
  const status = await getUserStatus(currentUser.uid);
  if (status.banned) return lockPosting('Tu esi bloķēts.');
  const body = commentForm.commentBody.value.trim();
  if (!body) return;

  const content = body.toLowerCase();
  if (containsBannedWords(content)) {
    await addStrike(currentUser.uid, "Banned words in comment");
    commentHint.textContent = 'Komentārs dzēsts: aizliegta leksika (strike pievienots).';
    setTimeout(() => (commentHint.textContent = ''), 2500);
    commentForm.reset();
    return;
  }

  const parentId = commentForm.dataset.replyTo || null;
  const cRef = push(ref(db, `comments/${currentDetailPost.id}`));
  await set(cRef, {
    body,
    createdAt: Date.now(),
    status: 'visible',
    author: {
      uid: currentUser.uid,
      name: displayNameInput.value.trim() || currentUser.displayName || currentUser.email || 'Anon'
    },
    reports: 0,
    likesCount: 0,
    parentId
  });
  commentForm.reset();
  commentForm.dataset.replyTo = '';
  commentHint.textContent = parentId ? 'Atbilde pievienota.' : 'Komentārs pievienots.';
  setTimeout(() => (commentHint.textContent = ''), 2000);
});

function startReply(parentId, comment) {
  commentForm.dataset.replyTo = parentId;
  commentForm.commentBody.focus();
  commentHint.textContent = `Atbildi ${comment.author?.name || 'Anon'}. ESC lai atceltu.`;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && commentForm.dataset.replyTo) {
    commentForm.dataset.replyTo = '';
    commentHint.textContent = 'Atbilde atcelta.';
    setTimeout(() => (commentHint.textContent = ''), 1200);
  }
});

// Likes with auth gate
async function toggleLikePost(post) {
  const user = await waitForAuth();
  if (!user || !post) {
    alert('Pieslēdzies, lai atzīmētu Patīk.');
    return;
  }
  const likeRef = ref(db, `postLikes/${post.id}/${user.uid}`);
  const countRef = ref(db, `posts/${post.id}/likesCount`);
  const already = (await get(likeRef)).exists();
  await runTransaction(countRef, (cur) => {
    const val = cur || 0;
    return already ? Math.max(0, val - 1) : val + 1;
  });
  await (already ? set(likeRef, null) : set(likeRef, true));
}
likePostBtn?.addEventListener('click', () => {
  if (currentDetailPost) toggleLikePost(currentDetailPost);
});

async function toggleLikeComment(postId, commentId) {
  const user = await waitForAuth();
  if (!user) {
    alert('Pieslēdzies, lai atzīmētu Patīk.');
    return;
  }
  const likeRef = ref(db, `commentLikes/${postId}/${commentId}/${user.uid}`);
  const countRef = ref(db, `comments/${postId}/${commentId}/likesCount`);
  const already = (await get(likeRef)).exists();
  await runTransaction(countRef, (cur) => {
    const val = cur || 0;
    return already ? Math.max(0, val - 1) : val + 1;
  });
  await (already ? set(likeRef, null) : set(likeRef, true));
}

// Reporting with overlay
function openReportOverlay({ targetType, postId, commentId = null, authorUid = null }) {
  if (!currentUser) {
    alert('Pieslēdzies.');
    return;
  }
  pendingReport = { targetType, postId, commentId, authorUid };
  reportTargetInfo.textContent = targetType === 'post'
    ? `Ziņo par ierakstu ${postId}`
    : `Ziņo par komentāru ${commentId}`;
  reportReason.value = '';
  reportOverlay.style.display = 'flex';
}
function closeReportOverlay() {
  pendingReport = null;
  reportOverlay.style.display = 'none';
}

reportCancel?.addEventListener('click', closeReportOverlay);

reportSubmit?.addEventListener('click', async () => {
  if (!pendingReport || !currentUser) return;
  const reason = (reportReason.value || '').trim().slice(0, 500);
  if (!reason) {
    alert('Ievadi iemeslu.');
    return;
  }

  const { targetType, postId, commentId, authorUid } = pendingReport;
  const updates = {};
  if (targetType === 'post') {
    const post = postsCache[postId];
    const newCount = (post?.reports || 0) + 1;
    updates[`posts/${postId}/reports`] = newCount;
    if (newCount >= REPORT_THRESHOLD) updates[`posts/${postId}/status`] = 'hidden';
  } else {
    const snap = await get(ref(db, `comments/${postId}/${commentId}`));
    const c = snap.val() || {};
    const newCount = (c.reports || 0) + 1;
    updates[`comments/${postId}/${commentId}/reports`] = newCount;
    if (newCount >= REPORT_THRESHOLD) updates[`comments/${postId}/${commentId}/status`] = 'hidden';
  }

  const repRef = push(ref(db, 'reports'));
  updates[`reports/${repRef.key}`] = {
    targetType,
    targetId: targetType === 'post' ? postId : commentId,
    postId,
    reason,
    reporterUid: currentUser.uid,
    authorUid: authorUid || null,
    status: 'open',
    createdAt: Date.now()
  };

  await update(ref(db), updates);
  closeReportOverlay();
  alert('Ziņots. Paldies.');
});

// Inbox overlay (fallback if guards.js not used)
function subscribeInbox(uid) {
  unsubscribeInbox();
  const inboxRef = ref(db, `userInbox/${uid}`);
  inboxUnsub = onValue(inboxRef, (snap) => {
    const msgs = snap.val() || {};
    const now = Date.now();
    Object.entries(msgs).forEach(([id, m]) => {
      if (m.expiresAt && now > m.expiresAt) {
        update(ref(db), { [`userInbox/${uid}/${id}`]: null });
        return;
      }
      if (document.getElementById(`overlay-${id}`)) return;
      const wrap = document.createElement('div');
      wrap.className = 'system-guard-overlay';
      wrap.id = `overlay-${id}`;
      wrap.innerHTML = `
        <div class="system-guard-box sg-info">
          <h3>Ziņa no atbalsta</h3>
          <div class="system-guard-msg">
            ${sanitize(m.text)}
            ${m.reason ? `<div class="small muted" style="margin-top:8px;">Iemesls: ${sanitize(m.reason)}</div>` : ""}
          </div>
          <div class="system-guard-actions">
            <button class="close" disabled>Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      const closeBtn = wrap.querySelector('button.close');
      let remaining = Math.max(1000, m.dismissibleAfter || 5000);
      const tick = 500;
      closeBtn.textContent = `Close (${Math.ceil(remaining/1000)}s)`;
      const iv = setInterval(() => {
        remaining -= tick;
        if (remaining > 0) {
          closeBtn.textContent = `Close (${Math.ceil(remaining/1000)}s)`;
        } else {
          clearInterval(iv);
          closeBtn.disabled = false;
          closeBtn.textContent = "Close";
          closeBtn.onclick = async () => {
            wrap.remove();
            const user = await waitForAuth();
            if (!user) return;
            await update(ref(db), { [`userInbox/${user.uid}/${id}`]: null });
          };
        }
      }, tick);
    });
  });
}
function unsubscribeInbox() {
  if (typeof inboxUnsub === 'function') inboxUnsub();
  inboxUnsub = null;
}

// Detail navigation
function openDetail(postId) {
  const post = postsCache[postId];
  if (!post) return;
  renderDetail(post);
}