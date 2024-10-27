const express = require("express");
const puppeteer = require("puppeteer");
const multer = require("multer");

const app = express();
const PORT = 3000;

const upload = multer();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/search", upload.none(), async (req, res) => {
  const { query } = req.body;
  console.log("Request body:", req.body);
  console.log("Query:", query);

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920x1080",
      ],
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    console.log("Navigating to Google...");
    await page.goto("https://www.google.com", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    console.log("Waiting for search box...");
    await page.waitForSelector('textarea[name="q"]', {
      visible: true,
      timeout: 5000,
    });

    console.log("Typing search query...");
    await page.type('textarea[name="q"]', query);
    await page.keyboard.press("Enter");

    console.log("Waiting for search results...");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 });

    const titles = await page.evaluate(() => {
      const selectors = [
        "div.g h3",
        "h3.r",
        "h3",
        "div[data-header-feature] h3",
        "div[data-content-feature] h3",
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements)
            .slice(0, 10)
            .map((el) => el.textContent.trim())
            .filter((title) => title.length > 0);
        }
      }
      return [];
    });

    console.log("Found titles:", titles);

    if (titles.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No search results found",
      });
    }

    res.json({
      success: true,
      count: titles.length,
      data: titles,
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while searching",
      details: error.message,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("Browser closed successfully");
      } catch (err) {
        console.error("Error closing browser:", err);
      }
    }
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Something broke!",
    details: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:3000`);
});
