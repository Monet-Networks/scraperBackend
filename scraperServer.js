const puppeteer = require("puppeteer-extra");
const express = require("express");
const cors = require("cors");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const bodyParser = require("body-parser");
const { URL } = require("url");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.json());

let browser, page;

const launchBrowser = async () => {
  browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    timeout: 60000,
  });
  page = await browser.newPage();

  // Set user agent and viewport for both TikTok and YouTube pages
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });
};

const closeBrowser = async () => {
  if (page) await page.close();
  if (browser) await browser.close();
};

// Common function to scrape YouTube video metadata
const scrapeYouTube = async (url) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

  // Wait for elements to load
  await page.waitForSelector("#owner-sub-count", { timeout: 60000 });
  await page.waitForSelector(".ytp-time-duration", { timeout: 60000 });
  await page.waitForSelector("#text-container", { timeout: 60000 });

  return page.evaluate(() => {
    const getText = (selector) =>
      document.querySelector(selector)?.textContent.trim();

    return {
      title: getText("#title h1 yt-formatted-string"),
      views: getText("#info span"),
      date: document.querySelector("#info-strings")?.textContent.trim(),
      likes: getText('button[aria-label^="like this video"]'),
      description: getText("#attributed-snippet-text"),
      channelName: getText("#text-container yt-formatted-string"),
      comments: getText("#contextual-info"),
      subscribers: getText("#owner-sub-count"),
    };
  });
};
{/* <p class="TUXText TUXText--tiktok-display TUXText--weight-bold ex6bx1a0 css-fl3jcf-StyledTUXText-StyledTimeDisplayText e1vx58lt0" font-size="32" letter-spacing="0" style="color: inherit; font-size: 32px;">00:49 / 01:05</p> */}

//images data-e2e="browse-user-avatar"

// Common function to scrape TikTok video metadata
const scrapeTikTok = async (url) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

  // Wait for elements to load
  await page.waitForSelector('meta[property="og:url"]', { timeout: 60000 });
  await page.waitForSelector('meta[property="og:image"]', { timeout: 60000 });
  await page.waitForSelector('strong[data-e2e="like-count"]');
  await page.waitForSelector('strong[data-e2e="comment-count"]');
  await page.waitForSelector('h1[data-e2e="browse-video-desc"]');
  await page.waitForSelector('strong[data-e2e="share-count"]', {
    timeout: 60000,
  });
  // await page.waitForSelector('meta[data-e2e="og:image"]', {
  //   timeout: 20000,
  // });

  return page.evaluate(() => {
    const getText = (selector) =>
      document.querySelector(selector)?.innerText || "N/A";
    const videoEle = document.querySelector('video');
    return {
      // views: getText('strong[data-e2e="video-views"]'),
      image: document.querySelector('img[loading="lazy"]')?.src||"Not Available",
      likes: getText('strong[data-e2e="like-count"]'),
      comments: getText('strong[data-e2e="comment-count"]'),
      description: getText('h1[data-e2e="browse-video-desc"]'),
      shares: getText('strong[data-e2e="share-count"]'),
      bookmark: getText('strong[data-e2e="undefined-count"]'),
      channelName: getText('span[data-e2e="browse-username"]'),
      videoUrl:
      document.querySelector('meta[property="og:url"]')?.content ||
      "Not Available",
      duration: videoEle.duration || 'N/A',
    };
  });
};

app.get("/scrape", async (req, res) => {
  const { url, platform } = req.query;
  const id = url.substring(url.search('video/')+6)
  if (!url || !platform) {
    return res
      .status(400)
      .json({ error: "Please provide a valid URL and platform." });
  }

  try {
    await launchBrowser();
    const validatedURL = new URL(url);
    let videoData;

    if (platform === "youtube") {
      videoData = await scrapeYouTube(validatedURL.href);
    } else if (platform === "tiktok") {
      videoData = await scrapeTikTok(validatedURL.href);
    } else {
      throw new Error("Unsupported platform.");
    }

    // videoData.videoUrl = url;
    res.json({ videoData,id, message: "Successfully retrieved video data" });
  } catch (error) {
    console.error("Error retrieving video metadata:", error);
    res.status(500).json({ error: "Failed to retrieve video metadata" });
  } finally {
    await closeBrowser();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


