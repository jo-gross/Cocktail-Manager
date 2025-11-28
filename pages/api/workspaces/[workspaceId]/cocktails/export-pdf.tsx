import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { $Enums, Role } from '@generated/prisma/client';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import React from 'react';
// @ts-ignore - react-dom/server types may not be available
import { renderToString } from 'react-dom/server';
import puppeteer, { Browser } from 'puppeteer-core';
import { CocktailPdfPage } from '../../../../../components/pdf/CocktailPdfPage';
import { PDFDocument } from 'pdf-lib';

const WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '200mb', // Increased for large PDF exports
  },
};

async function generatePdf(html: string, numberOfCocktails: number, showHeader: boolean = false, showFooter: boolean = false): Promise<Buffer> {
  const chromiumHost = process.env.CHROMIUM_HOST;
  console.debug('chromiumHost', chromiumHost);

  // Calculate timeout: minimum 10 seconds per cocktail
  const timeoutMs = Math.max(10000 * numberOfCocktails, 30000); // At least 30 seconds minimum
  console.debug(`Setting timeout to ${timeoutMs}ms for ${numberOfCocktails} cocktails`);

  // Due to some issues with Chromium, we need to connect to the browser manually
  let browser: Browser | undefined;
  try {
    if (chromiumHost && chromiumHost !== 'localhost' && chromiumHost !== '127.0.0.1') {
      console.debug('Fetching WebSocket URL from Chromium...');
      const dns = require('dns').promises;

      try {
        const { address: chromeIP } = await dns.lookup(chromiumHost);
        console.debug('Chromium IP:', chromeIP);

        const browserURL = `http://${chromeIP}:9222`;
        console.debug('Connecting to Chromium via browserURL:', browserURL);

        browser = await puppeteer.connect({
          browserURL: browserURL,
        });
        console.debug('Successfully connected via DNS-resolved IP');
      } catch (dnsError) {
        console.error('DNS lookup failed, trying hostname directly:', dnsError);
        // Fallback: try with hostname directly
        const browserURL = `http://${chromiumHost}:9222`;
        browser = await puppeteer.connect({
          browserURL: browserURL,
        });
        console.debug('Successfully connected via hostname');
      }
    } else if (chromiumHost === 'localhost' || chromiumHost === '127.0.0.1') {
      // Connect to localhost Chromium
      console.debug('Connecting to localhost Chromium');
      browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
      });
      console.debug('Successfully connected to localhost');
    } else {
      // Fallback: launch local Chromium (if available)
      console.debug('No Chromium host specified, launching local Chromium - assuming it is installed at the instance');
      browser = await puppeteer.launch();
    }

    const page = await browser.newPage();

    // Set default timeout for page operations
    page.setDefaultTimeout(timeoutMs);

    // Set viewport to ensure proper rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1,
    });

    // Load Tailwind and DaisyUI first, then set content
    await page.addScriptTag({ url: 'https://cdn.tailwindcss.com' });
    await page.addStyleTag({ url: 'https://cdn.jsdelivr.net/npm/daisyui@4.12.23/dist/full.min.css' });

    // Set content and wait for everything to load
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: timeoutMs });

    // Set DaisyUI theme to "autumn" and ensure white background
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'autumn');
      // Set white background explicitly
      document.body.style.backgroundColor = 'white';
      document.documentElement.style.backgroundColor = 'white';
    });

    // Wait for Tailwind to process the classes - longer wait for large documents
    const renderWaitTime = Math.min(3000 + numberOfCocktails * 500, 10000); // 3s base + 0.5s per cocktail, max 10s
    console.debug(`Waiting ${renderWaitTime}ms for rendering to complete`);
    await new Promise((resolve) => setTimeout(resolve, renderWaitTime));

    // Verify that the page has rendered correctly
    await page.evaluate(() => {
      // Force a reflow to ensure all styles are applied
      document.body.offsetHeight;
    });

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`PDF generation timed out after ${timeoutMs}ms for ${numberOfCocktails} cocktails`));
      }, timeoutMs);
    });

    // Race between PDF generation and timeout
    let pdfBuffer: Buffer;
    try {
      // Prepare header and footer templates for Puppeteer
      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const headerTemplate = showHeader
        ? `<div style="font-size: 8pt; color: rgba(0, 0, 0, 0.6); width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 5mm;">
            <div style="flex: 1;"></div>
            <div style="flex: 1; text-align: center;">Cocktail-Manager Export</div>
            <div style="flex: 1; text-align: right;">${formattedDate}</div>
          </div>`
        : '<div></div>';

      const footerTemplate = showFooter
        ? `<div style="font-size: 8pt; color: rgba(0, 0, 0, 0.6); width: 100%; text-align: center; padding: 0 5mm;">
            Seite <span class="pageNumber"></span>
          </div>`
        : '<div></div>';

      pdfBuffer = (await Promise.race([
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: showHeader ? '10mm' : '5mm',
            right: '5mm',
            bottom: showFooter ? '10mm' : '5mm',
            left: '5mm',
          },
          preferCSSPageSize: false,
          displayHeaderFooter: showHeader || showFooter,
          headerTemplate: headerTemplate,
          footerTemplate: footerTemplate,
        }),
        timeoutPromise,
      ])) as Buffer;
    } catch (pdfError) {
      console.error('PDF generation error details:', {
        error: pdfError,
        numberOfCocktails,
        htmlLength: html.length,
        timeoutMs,
      });

      // Try to get more information about the page state
      try {
        const pageInfo = await page.evaluate(() => {
          return {
            bodyHeight: document.body?.scrollHeight || 0,
            bodyWidth: document.body?.scrollWidth || 0,
            pageCount: document.querySelectorAll('.pdf-page').length,
          };
        });
        console.error('Page state at error:', pageInfo);
      } catch (infoError) {
        console.error('Could not get page info:', infoError);
      }

      throw pdfError;
    }

    await page.close();

    // Explicitly disconnect browser to free up resources and close tabs
    await browser.disconnect();
    console.debug('Browser connection closed after PDF generation');

    return Buffer.from(pdfBuffer);
  } catch (error) {
    // Ensure browser is always disconnected, even on error
    if (browser) {
      try {
        await browser.disconnect();
        console.debug('Browser connection closed after error');
      } catch (disconnectError) {
        console.error('Error disconnecting browser:', disconnectError);
      }
    }
    throw error;
  }
}

function getTranslation(translations: Record<string, Record<string, string>>, key: string, language: 'de' = 'de'): string {
  return translations[language]?.[key] ?? key;
}

function generateHtmlForCocktails(
  cocktails: any[],
  translations: Record<string, Record<string, string>>,
  options: {
    exportImage: boolean;
    exportDescription: boolean;
    exportNotes: boolean;
    exportHistory: boolean;
    newPagePerCocktail: boolean;
    showHeader: boolean;
    showFooter: boolean;
  },
): string {
  const pages = cocktails.map((cocktail, index) => {
    console.log('Rendering cocktail', cocktail.name);
    // Extract base64 image from CocktailRecipeImage if available
    const imageBase64 = options.exportImage ? cocktail.CocktailRecipeImage?.[0]?.image || null : null;
    const componentHtml = renderToString(
      React.createElement(CocktailPdfPage, {
        cocktail,
        imageBase64,
        getTranslation: (key: string) => getTranslation(translations, key),
        exportImage: options.exportImage,
        exportDescription: options.exportDescription,
        exportNotes: options.exportNotes,
        exportHistory: options.exportHistory,
      }),
    );
    const pageBreakClass = options.newPagePerCocktail ? 'pdf-page' : 'pdf-page-no-break';
    return `<div class="${pageBreakClass}" data-cocktail-id="${cocktail.id}" data-cocktail-index="${index}" data-cocktail-name="${cocktail.name}">${componentHtml}</div>`;
  });

  const footerHtml = '';

  const headerFooterStyles =
    options.showHeader || options.showFooter
      ? `
    @page {
      margin-top: ${options.showHeader ? '10mm' : '5mm'};
      margin-bottom: ${options.showFooter ? '10mm' : '5mm'};
    }
    `
      : '';

  return `<!DOCTYPE html>
<html lang="de" data-theme="autumn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cocktail Export</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.min.css" rel="stylesheet" type="text/css" />
  <script src="https://cdn.tailwindcss.com"></script>  
  
  <style>
    html {
      -webkit-print-color-adjust: exact;
    }
  
    * {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      background: white;
    }
    .pdf-page {
      page-break-after: always;
      background: white;
    }
    .pdf-page:last-child {
      page-break-after: auto;
      min-height: auto;
    }
    /* Nur für Seiten, die nicht die letzte sind, volle Höhe erzwingen */
    .pdf-page:not(:last-child) {
      min-height: 100vh;
    }
    .pdf-page-no-break {
      background: white;
      margin-bottom: 2rem;
    }
    .long-text-format {
      white-space: pre-line;
      text-align: justify;
      word-break: break-word;
    }
    ${headerFooterStyles}
  </style>
</head>
<body class='bg-white'>
  ${pages.join('')}
  ${footerHtml}
  <script>
    (function() {
      // Headers are now rendered per cocktail block, so no JavaScript needed
      // Footer page numbers are handled by Puppeteer's displayHeaderFooter
    })();
  </script>
</body>
</html>`;
}

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    try {
      const {
        cocktailIds,
        exportImage = true,
        exportDescription = true,
        exportNotes = true,
        exportHistory = true,
        newPagePerCocktail = true,
        showHeader = false,
        showFooter = false,
      } = req.body;

      if (!cocktailIds || !Array.isArray(cocktailIds) || cocktailIds.length === 0) {
        return res.status(400).json({ message: 'cocktailIds array is required and must not be empty' });
      }

      // Load cocktails from database with images
      const cocktails = await prisma.cocktailRecipe.findMany({
        where: {
          id: { in: cocktailIds },
          workspaceId: workspace.id,
        },
        include: {
          _count: { select: { CocktailRecipeImage: true } },
          CocktailRecipeImage: {
            select: {
              image: true,
            },
          },
          ice: true,
          glass: { include: { _count: { select: { GlassImage: true } } } },
          garnishes: {
            include: {
              garnish: { include: { _count: { select: { GarnishImage: true } } } },
            },
          },
          steps: {
            include: {
              action: true,
              ingredients: {
                include: {
                  ingredient: { include: { _count: { select: { IngredientImage: true } } } },
                  unit: true,
                },
              },
            },
          },
          ratings: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      if (cocktails.length === 0) {
        return res.status(404).json({ message: 'No cocktails found' });
      }

      // Check if Chromium service is available
      if (!process.env.CHROMIUM_HOST) {
        return res.status(503).json({ message: 'PDF export service is not configured' });
      }

      // Load workspace translations
      const translationSetting = await prisma.workspaceSetting.findFirst({
        where: {
          workspaceId: workspace.id,
          setting: WorkspaceSettingKey.translations,
        },
      });

      const translations: Record<string, Record<string, string>> = translationSetting?.value ? JSON.parse(translationSetting.value) : { de: {} };

      // Always use max 10 cocktails per batch to prevent browser tab overflow
      const batchSize = 10;
      const batches: any[][] = [];

      for (let i = 0; i < cocktails.length; i += batchSize) {
        batches.push(cocktails.slice(i, i + batchSize));
      }

      console.log(`Generating PDF in ${batches.length} batches of max ${batchSize} cocktails each`);

      // Generate PDFs for each batch - browser connection is closed after each batch
      const pdfBuffers: Buffer[] = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} cocktails`);

        try {
          const html = generateHtmlForCocktails(batch, translations, {
            exportImage,
            exportDescription,
            exportNotes,
            exportHistory,
            newPagePerCocktail,
            showHeader,
            showFooter,
          });
          const batchPdfBuffer = await generatePdf(html, batch.length, showHeader, showFooter);
          pdfBuffers.push(batchPdfBuffer);
          console.log(`Batch ${i + 1}/${batches.length} completed successfully`);
        } catch (batchError) {
          console.error(`Error processing batch ${i + 1}/${batches.length}:`, batchError);
          // Re-throw to stop processing if a batch fails
          throw batchError;
        }
      }

      // Merge all PDFs into one document
      console.log(`Merging ${pdfBuffers.length} PDF batches`);
      const mergedPdf = await PDFDocument.create();

      for (const pdfBuffer of pdfBuffers) {
        const pdf = await PDFDocument.load(pdfBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      const finalPdfBytes = await mergedPdf.save();
      const finalPdfBuffer = Buffer.from(finalPdfBytes);

      // Return PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cocktails-export-${Date.now()}.pdf"`);
      res.setHeader('Content-Length', finalPdfBuffer.length.toString());
      return res.send(finalPdfBuffer);
    } catch (error) {
      console.error('PDF export error:', error);
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
          return res.status(503).json({ message: 'Chromium service is not available' });
        }
        return res.status(500).json({ message: `PDF generation failed: ${error.message}` });
      }
      return res.status(500).json({ message: 'PDF generation failed' });
    }
  }),
});
