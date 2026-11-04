// #tag: letters, digits and underscores in any script, up to 50 chars
const HASHTAG = /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,50})/gu;
// @username: same rules as registration (3-30 letters, digits, underscores)
const MENTION = /(?:^|[^\w@])@(\w{3,30})\b/g;

const unique = (values) => [...new Set(values)];

const extractHashtags = (text = '') =>
  unique([...text.matchAll(HASHTAG)].map((m) => m[1].toLowerCase()));

const extractMentions = (text = '') => unique([...text.matchAll(MENTION)].map((m) => m[1]));

// Escape user input before using it inside a RegExp
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  extractHashtags,
  extractMentions,
  escapeRegex,
};
