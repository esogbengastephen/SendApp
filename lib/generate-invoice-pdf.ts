/**
 * Generate PDF from invoice URL using Puppeteer
 */

export async function generateInvoicePDF(invoiceUrl: string): Promise<Buffer | null> {
  try {
    // Dynamically import puppeteer to avoid issues if not installed
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    
    // Set viewport to A4 size
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      deviceScaleFactor: 2,
    });

    // Navigate to invoice page
    await page.goto(invoiceUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for invoice content to load
    await page.waitForSelector('.bg-white, .bg-slate-800', { timeout: 10000 });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      preferCSSPageSize: false,
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
  } catch (error: any) {
    console.error('[PDF Generation] Error:', error);
    // Return null if PDF generation fails - email will still be sent without attachment
    return null;
  }
}
