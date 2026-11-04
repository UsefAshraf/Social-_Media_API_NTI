const Post = require('../src/shared/models/Post');
const { api, registerUser, createPost } = require('./helpers');
const { extractHashtags, extractMentions } = require('../src/shared/utils/text');

const search = (user, query) => api().get('/api/v2/search').query(query).set('Authorization', user.auth);
const notificationsOf = async (user) =>
  (await api().get('/api/v2/notifications').set('Authorization', user.auth)).body.data;

describe('text helpers', () => {
  it('extracts unique, lowercased hashtags', () => {
    expect(extractHashtags('Learning #NodeJS and #nodejs with #Mongo_DB! email@x.com#no')).toEqual(['nodejs', 'mongo_db']);
  });

  it('extracts mentions but not emails', () => {
    expect(extractMentions('hi @alice and @bob_1, mail me at me@example.com')).toEqual(['alice', 'bob_1']);
  });
});

describe('search, hashtags and mentions', () => {
  let alice;
  let bob;

  beforeAll(() => Post.init()); // text index must exist before $text queries

  beforeEach(async () => {
    alice = await registerUser({ username: 'alice' });
    bob = await registerUser({ username: 'bobby' });
  });

  it('stores hashtags and lists posts by hashtag', async () => {
    const post = await createPost(alice, 'Shipping a new API #NodeJS #express');
    expect(post.hashtags).toEqual(['nodejs', 'express']);

    await createPost(bob, 'Unrelated post');
    const res = await api().get('/api/v2/posts/hashtag/nodejs').set('Authorization', bob.auth);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0]._id).toBe(post._id);
  });

  it('updates hashtags when a post is edited', async () => {
    const post = await createPost(alice, 'Hello #one');
    const res = await api()
      .patch(`/api/v2/posts/${post._id}`)
      .set('Authorization', alice.auth)
      .send({ content: 'Hello #two' });
    expect(res.body.data.hashtags).toEqual(['two']);
  });

  it('finds users by username prefix', async () => {
    const res = await search(alice, { q: 'bob' });
    expect(res.body.data.users.map((u) => u.username)).toEqual(['bobby']);

    const onlyUsers = await search(alice, { q: '@ali' });
    expect(onlyUsers.body.data.users.map((u) => u.username)).toEqual(['alice']);
    expect(onlyUsers.body.data.posts).toEqual([]);
  });

  it('finds posts by full-text search', async () => {
    await createPost(alice, 'Deploying MongoDB clusters today');
    await createPost(bob, 'Baking bread');

    const res = await search(bob, { q: 'mongodb', type: 'posts' });
    expect(res.body.data.posts.map((p) => p.content)).toEqual(['Deploying MongoDB clusters today']);
  });

  it('suggests hashtags with post counts', async () => {
    await createPost(alice, '#javascript tips');
    await createPost(bob, 'more #javascript and #java');

    const res = await search(alice, { q: '#jav' });
    expect(res.body.data.hashtags).toEqual([
      { tag: 'javascript', posts: 2 },
      { tag: 'java', posts: 1 },
    ]);
  });

  it('treats regex characters in queries literally', async () => {
    const res = await search(alice, { q: '.*' });
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([]);
  });

  it('requires a query', async () => {
    const res = await search(alice, {});
    expect(res.status).toBe(400);
  });

  it('notifies mentioned users once per post', async () => {
    const post = await createPost(alice, 'Thanks @bobby and @ghost_user!');
    expect(post.mentions).toEqual([bob.id]);

    // editing without adding new mentions does not notify again
    await api()
      .patch(`/api/v2/posts/${post._id}`)
      .set('Authorization', alice.auth)
      .send({ content: 'Thanks again @bobby' });

    const mentions = (await notificationsOf(bob)).filter((n) => n.type === 'mention');
    expect(mentions).toHaveLength(1);
    expect(mentions[0].content).toBe('alice mentioned you in a post');
  });

  it('notifies users mentioned in comments', async () => {
    const charlie = await registerUser({ username: 'charlie' });
    const post = await createPost(alice, 'A post');

    await api()
      .post(`/api/v2/posts/${post._id}/comments`)
      .set('Authorization', bob.auth)
      .send({ content: '@charlie look at this' });

    const [notification] = await notificationsOf(charlie);
    expect(notification).toMatchObject({ type: 'mention', content: 'bobby mentioned you in a comment' });
  });
});
