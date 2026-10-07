'use strict';

/**
 * 演示数据（seed）。
 * 为什么放在这里：首次启动数据库为空时自动写入少量示例，保证前端无需手动造数据即可联调。
 * 所有写入均使用参数化语句（architecture.md §8.2）。
 */
const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'password123'; // 仅演示用；真实注册走用户输入。

function seedIfEmpty(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return false; // 已有数据，不重复播种

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const seed = db.transaction(() => {
    const insertUser = db.prepare(
      `INSERT INTO users (username, password_hash, nickname, avatar, bio)
       VALUES (@username, @password_hash, @nickname, @avatar, @bio)`
    );
    const users = [
      { username: 'alice', nickname: 'Alice', avatar: null, bio: '热爱分享的前端工程师' },
      { username: 'bob', nickname: 'Bob', avatar: null, bio: '后端 & 数据库爱好者' },
      { username: 'carol', nickname: 'Carol', avatar: null, bio: '全栈练习生' },
    ];
    const userIds = {};
    for (const u of users) {
      const info = insertUser.run({ ...u, password_hash: hash });
      userIds[u.username] = Number(info.lastInsertRowid);
    }

    const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
    const tagIds = {};
    for (const name of ['javascript', 'react', 'node', 'sqlite']) {
      tagIds[name] = Number(insertTag.run(name).lastInsertRowid);
    }

    const insertPost = db.prepare(
      `INSERT INTO posts (author_id, title, content) VALUES (?, ?, ?)`
    );
    const linkTag = db.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)');
    const posts = [
      {
        author: 'alice',
        title: '用 React 18 搭建社区前端的心得',
        content: '本文记录我在 Vite + React Router v6 下搭建 SPA 的实践，重点是如何设计 API 层与登录态。',
        tags: ['react', 'javascript'],
      },
      {
        author: 'bob',
        title: 'better-sqlite3 为什么这么适合小项目',
        content: '同步 API、零外部依赖、开箱即跑，配合参数化查询即可满足绝大多数中小型社区场景。',
        tags: ['node', 'sqlite'],
      },
      {
        author: 'carol',
        title: '从零实现一个点赞功能要注意什么',
        content: '幂等是关键词：借助 UNIQUE(user_id, post_id) 约束，重复点赞不会产生脏数据。',
        tags: ['javascript', 'sqlite'],
      },
    ];
    const postIds = [];
    for (const p of posts) {
      const id = Number(insertPost.run(userIds[p.author], p.title, p.content).lastInsertRowid);
      postIds.push(id);
      for (const t of p.tags) linkTag.run(id, tagIds[t]);
    }

    const insertComment = db.prepare(
      'INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)'
    );
    insertComment.run(postIds[0], userIds.bob, '写得很好，API 分层值得借鉴！');
    insertComment.run(postIds[0], userIds.carol, '请问登录态刷新是怎么处理的？');
    insertComment.run(postIds[1], userIds.alice, '同意，配合 WAL 读写体验很棒。');

    const insertLike = db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)');
    insertLike.run(userIds.bob, postIds[0]);
    insertLike.run(userIds.carol, postIds[0]);
    insertLike.run(userIds.alice, postIds[1]);

    const insertFollow = db.prepare(
      'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)'
    );
    insertFollow.run(userIds.alice, userIds.bob);
    insertFollow.run(userIds.carol, userIds.alice);
  });

  seed();
  return true;
}

module.exports = { seedIfEmpty, DEMO_PASSWORD };

// 支持 `npm run seed` 手动执行（此时会连接真实库，若为空则播种）。
if (require.main === module) {
  const db = require('./index'); // 加载时会自动建表并按需播种
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  console.log(`[seed] 完成，当前用户数：${count}（演示密码：${DEMO_PASSWORD}）`);
}
