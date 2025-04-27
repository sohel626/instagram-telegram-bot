// instagram_to_telegram_sender.js

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// --------------- CONFIG ----------------
const TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';  // <<< Put your bot token
const CHANNEL_ID = '@your_channel_id';    // <<< Put your channel username or chat ID
const HTML_FILE = 'part1.html';            // <<< Your HTML file name

const BATCH_SIZE = 100;    // send 100 posts in 1 batch
const SMALL_DELAY = 3000;  // 3 sec between batches
const BIG_DELAY = 120000;  // 2 min between 1000 posts
// --------------- CONFIG ----------------

// Initialize bot
const bot = new TelegramBot(TOKEN, { polling: false });

// Load progress
let progress = 0;
if (fs.existsSync('progress.json')) {
  progress = JSON.parse(fs.readFileSync('progress.json')).lastPost || 0;
}

// Extract posts from HTML
function extractPosts(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const $ = cheerio.load(html);
  const posts = [];

  $('a').each((i, elem) => {
    const link = $(elem).attr('href');
    const text = $(elem).text();
    if (link && text.startsWith('#')) {
      const postNumber = parseInt(text.replace('#', '').trim());
      const usernameElem = $(elem).next();
      const username = usernameElem.text().trim();
      posts.push({ postNumber, link, username });
    }
  });

  return posts;
}

// Download media
async function downloadMedia(instaUrl) {
  try {
    const apiUrl = `https://igram.world/api/ajax`;
    const formData = new URLSearchParams();
    formData.append('url', instaUrl);

    const response = await axios.post(apiUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const mediaUrl = response.data.data?.[0]?.url;
    if (!mediaUrl) return null;

    const media = await axios.get(mediaUrl, { responseType: 'stream' });
    return media.data;
  } catch (err) {
    console.error('Failed to download:', instaUrl);
    return null;
  }
}

// Send post
async function sendPost(post) {
  try {
    const instaUrl = `https://www.instagram.com${post.link}`;
    const mediaStream = await downloadMedia(instaUrl);
    if (!mediaStream) return;

    const caption = `Post #${post.postNumber}\n${post.username}\nFrom: @${instaUrl.replace('https://', '')}`;

    await bot.sendVideo(CHANNEL_ID, mediaStream, {
      caption: caption,
      parse_mode: 'HTML'
    });

    console.log(`✅ Sent Post #${post.postNumber}`);
  } catch (err) {
    console.error(`❌ Error sending Post #${post.postNumber}:`, err.message);
  }
}

// Save progress
function saveProgress(postNumber) {
  fs.writeFileSync('progress.json', JSON.stringify({ lastPost: postNumber }, null, 2));
}

// Main function
async function main() {
  const posts = extractPosts(HTML_FILE);

  console.log(`Total Posts Found: ${posts.length}`);
  console.log(`Starting from Post #${progress + 1}`);

  for (let i = progress; i < posts.length; i++) {
    await sendPost(posts[i]);
    saveProgress(posts[i].postNumber);

    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`⏳ Waiting ${SMALL_DELAY / 1000}s after batch...`);
      await new Promise(r => setTimeout(r, SMALL_DELAY));
    }

    if ((i + 1) % (BATCH_SIZE * 10) === 0) {
      console.log(`😴 Waiting ${BIG_DELAY / 1000}s after 1000 posts...`);
      await new Promise(r => setTimeout(r, BIG_DELAY));
    }
  }

  console.log('🎉 All posts completed!');
}

main();
Add main bot script
