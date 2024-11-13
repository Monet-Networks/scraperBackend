const puppeteer = require("puppeteer-extra");
const express = require("express");
const cors = require("cors");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const bodyParser = require("body-parser");
const { URL } = require("url");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 5000;

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
    const getText = (selector) => document.querySelector(selector)?.textContent.trim();
    return {
      title: getText("#title h1 yt-formatted-string"),
      views: getText("#info span"),
      likes: getText('button[aria-label^="like this video"]'),
      description: getText("#attributed-snippet-text"),
      channelName: getText("#text-container yt-formatted-string"),
      subscribers: getText("#owner-sub-count"),
    };
  });
};

// Common function to scrape TikTok video metadata
const scrapeTikTok = async (url) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

  // Wait for elements to load
  await page.waitForSelector('meta[property="og:url"]', { timeout: 60000 });
  await page.waitForSelector('strong[data-e2e="share-count"]', { timeout: 60000 });

  return page.evaluate(() => {
    const getText = (selector) => document.querySelector(selector)?.innerText || "N/A";
    return {
      views: getText('strong[data-e2e="video-views"]'),
      likes: getText('strong[data-e2e="like-count"]'),
      comments: getText('strong[data-e2e="comment-count"]'),
      shares: getText('strong[data-e2e="share-count"]'),
      channelName: getText('span[data-e2e="browse-username"]'),
      videoUrl: document.querySelector('meta[property="og:url"]')?.content || "Not Available",
    };
  });
};

app.get("/scrape", async (req, res) => {
  const { url, platform } = req.query;

  if (!url || !platform) {
    return res.status(400).json({ error: "Please provide a valid URL and platform." });
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

    videoData.videoUrl = url;
    res.json({ videoData, message: "Successfully retrieved video data" });
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