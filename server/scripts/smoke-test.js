'use strict';

/**
 * 端到端冒烟测试：逐个验证 docs/architecture.md §6 的全部端点与关键错误码。
 * 用法：node scripts/smoke-test.js [baseUrl]
 * 默认 baseUrl = http://localhost:3999/api
 */
const BASE = process.argv[2] || 'http://localhost:3999/api';

let passed = 0;
let failed = 0;

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra ?? '');
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const username = `u${suffix}`;
  console.log(`\n[1] 认证 (base=${BASE})`);
  const reg = await api('POST', '/auth/register', {
    body: { username, password: 'secret123', nickname: '测试用户' },
  });
  check('POST /auth/register 返回 201 + token', reg.status === 201 && reg.json.code === 0 && reg.json.data.token, reg.json);
  check('注册响应不含 password_hash', JSON.stringify(reg.json).indexOf('password_hash') === -1);
  const token = reg.json.data.token;
  const myId = reg.json.data.user.id;

  const dup = await api('POST', '/auth/register', {
    body: { username, password: 'secret123' },
  });
  check('重复用户名返回 1002', dup.json.code === 1002, dup.json);

  const badLogin = await api('POST', '/auth/login', {
    body: { username, password: 'wrongpass' },
  });
  check('错误密码返回 1003', badLogin.json.code === 1003, badLogin.json);

  const login = await api('POST', '/auth/login', {
    body: { username, password: 'secret123' },
  });
  check('POST /auth/login 成功', login.json.code === 0 && login.json.data.token, login.json);

  const me = await api('GET', '/auth/me', { token });
  check('GET /auth/me 返回当前用户', me.json.code === 0 && me.json.data.user.id === myId, me.json);
  const noAuth = await api('GET', '/auth/me');
  check('缺失 token 返回 2001/401', noAuth.status === 401 && noAuth.json.code === 2001, noAuth);
  const badToken = await api('GET', '/auth/me', { token: 'xxx.yyy.zzz' });
  check('无效 token 返回 2002/401', badToken.status === 401 && badToken.json.code === 2002, badToken);

  console.log('\n[2] 帖子 CRUD');
  const created = await api('POST', '/posts', {
    token,
    body: { title: '冒烟测试帖标题', content: '这是冒烟测试的正文内容。', tags: ['smoke', 'react'] },
  });
  check('POST /posts 返回 201 且含 tags', created.status === 201 && created.json.data.post.tags.includes('smoke'), created.json);
  const postId = created.json.data.post.id;

  const list = await api('GET', '/posts?page=1&pageSize=5');
  check('GET /posts 分页结构正确', list.json.code === 0 && Array.isArray(list.json.data.list) && list.json.data.pagination.page === 1, list.json);

  const byTag = await api('GET', '/posts?tag=react');
  check('GET /posts?tag=react 过滤生效', byTag.json.code === 0 && byTag.json.data.list.length >= 1, byTag.json);

  const byQ = await api('GET', '/posts?q=冒烟');
  check('GET /posts?q= 搜索生效', byQ.json.code === 0 && byQ.json.data.list.some((p) => p.id === postId), byQ.json);

  const byAuthor = await api('GET', `/posts?authorId=${myId}`);
  check('GET /posts?authorId= 过滤生效', byAuthor.json.data.list.every((p) => p.author.id === myId), byAuthor.json);

  const hot = await api('GET', '/posts?sort=hot');
  check('GET /posts?sort=hot 可用', hot.json.code === 0, hot.json);

  const detail = await api('GET', `/posts/${postId}`, { token });
  check('GET /posts/:id 详情', detail.json.code === 0 && detail.json.data.post.id === postId, detail.json);
  check('详情 liked 字段存在', typeof detail.json.data.post.liked === 'boolean');

  const updated = await api('PUT', `/posts/${postId}`, {
    token,
    body: { title: '冒烟测试帖标题(改)', tags: ['smoke'] },
  });
  check('PUT /posts/:id 编辑成功', updated.json.data.post.title.includes('(改)') && updated.json.data.post.tags.length === 1, updated.json);

  console.log('\n[3] 点赞');
  const like1 = await api('POST', `/posts/${postId}/like`, { token });
  const like2 = await api('POST', `/posts/${postId}/like`, { token });
  check('POST /like 幂等 + liked=true', like1.json.data.liked === true && like1.json.data.likeCount === like2.json.data.likeCount, like1.json);
  const unlike = await api('DELETE', `/posts/${postId}/like`, { token });
  check('DELETE /like 取消点赞', unlike.json.data.liked === false, unlike.json);

  console.log('\n[4] 评论');
  const c1 = await api('POST', `/posts/${postId}/comments`, { token, body: { content: '第一条评论' } });
  check('POST 评论成功', c1.status === 201 && c1.json.data.comment.content === '第一条评论', c1.json);
  const cId = c1.json.data.comment.id;
  const cl = await api('GET', `/posts/${postId}/comments`);
  check('GET 评论列表', cl.json.data.list.length >= 1 && cl.json.data.list[0].author.username, cl.json);
  const cd = await api('DELETE', `/comments/${cId}`, { token });
  check('DELETE 评论成功', cd.json.data.id === cId, cd.json);

  console.log('\n[5] 用户与关注');
  const profile = await api('GET', `/users/1`, { token });
  check('GET /users/:id 含 stats 与 followed', profile.json.data.stats && typeof profile.json.data.followed === 'boolean', profile.json);
  const uposts = await api('GET', `/users/1/posts`);
  check('GET /users/:id/posts', uposts.json.code === 0 && Array.isArray(uposts.json.data.list), uposts.json);

  const follow = await api('POST', '/users/1/follow', { token });
  check('POST /users/1/follow 成功', follow.json.code === 0 && follow.json.data.followed === true, follow.json);
  const followAgain = await api('POST', '/users/1/follow', { token });
  check('重复关注幂等', followAgain.json.data.followed === true && followAgain.json.data.followerCount === follow.json.data.followerCount, followAgain.json);
  const followers = await api('GET', '/users/1/followers');
  check('GET /users/1/followers', followers.json.code === 0 && Array.isArray(followers.json.data.list), followers.json);
  const following = await api('GET', '/users/1/following');
  check('GET /users/1/following', following.json.code === 0 && Array.isArray(following.json.data.list), following.json);
  const unfollow = await api('DELETE', '/users/1/follow', { token });
  check('DELETE 取关成功', unfollow.json.data.followed === false, unfollow.json);
  const selfFollow = await api('POST', `/users/${myId}/follow`, { token });
  check('自关注返回 3002/400', selfFollow.json.code === 3002, selfFollow.json);
  const followMissing = await api('POST', '/users/999999/follow', { token });
  check('关注不存在用户返回 4001/404', followMissing.status === 404 && followMissing.json.code === 4001, followMissing.json);

  const updateMe = await api('PUT', '/users/me', { token, body: { nickname: '新昵称', bio: '简介更新' } });
  check('PUT /users/me 更新资料', updateMe.json.data.user.nickname === '新昵称', updateMe.json);

  console.log('\n[6] 标签与搜索');
  const tags = await api('GET', '/tags');
  check('GET /tags 含 postCount', tags.json.code === 0 && tags.json.data.list.every((t) => 'postCount' in t), tags.json);
  const tagPosts = await api('GET', '/tags/react/posts');
  check('GET /tags/:name/posts', tagPosts.json.code === 0 && tagPosts.json.data.tag.name === 'react', tagPosts.json);
  const searchPost = await api('GET', '/search?q=冒烟&type=post');
  check('GET /search type=post', searchPost.json.code === 0 && searchPost.json.data.type === 'post', searchPost.json);
  const searchUser = await api('GET', `/search?q=${username.slice(0, 5)}&type=user`);
  check('GET /search type=user', searchUser.json.code === 0 && searchUser.json.data.list.length >= 1, searchUser.json);
  const searchEmpty = await api('GET', '/search?q=');
  check('空 q 返回 1001', searchEmpty.json.code === 1001, searchEmpty.json);

  console.log('\n[7] 权限与校验');
  const forbiddenPut = await api('PUT', '/posts/1', { token, body: { title: 'x' } });
  check('改他人帖子返回 3001/403', forbiddenPut.json.code === 3001, forbiddenPut.json);
  const badPost = await api('POST', '/posts', { token, body: { title: '', content: 'x' } });
  check('非法 title 返回 1001', badPost.json.code === 1001, badPost.json);
  const notFound = await api('GET', '/posts/999999');
  check('不存在帖子返回 4001/404', notFound.status === 404 && notFound.json.code === 4001, notFound.json);
  const badTags = await api('POST', '/posts', { token, body: { title: 't', content: 'c', tags: 'notarray' } });
  check('非法 tags 返回 1004', badTags.json.code === 1004, badTags.json);

  console.log('\n[8] 清理');
  const del = await api('DELETE', `/posts/${postId}`, { token });
  check('DELETE /posts/:id 成功', del.json.data.id === postId, del.json);

  console.log(`\n结果：通过 ${passed}，失败 ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试异常：', e);
  process.exit(1);
});
