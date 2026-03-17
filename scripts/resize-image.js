#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Note: iphone screenshots are 1260 x 2736 or 1284 x 2778 

function printUsageAndExit() {
  const scriptName = path.basename(process.argv[1] || 'resize-image.js');
  console.error(`Usage: ${scriptName} <inputPath> <width> <height>`);
  console.error(`Example: ${scriptName} assets/images/photo.png 1024 1024`);
  process.exit(1);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`Invalid ${name}: ${value}`);
    printUsageAndExit();
  }
  return parsed;
}

function buildOutputPath(inputPath, width, height) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}-${width}x${height}${parsed.ext}`);
}

function askYesNo(question) {
  return new Promise((resolve) => {
    // Lazy-require so the script can still be imported without side effects.
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      const normalized = String(answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

function aspectRatioPreserved(origWidth, origHeight, targetWidth, targetHeight) {
  // Compare cross-products to avoid floating point issues.
  const left = origWidth * targetHeight;
  const right = origHeight * targetWidth;
  const diff = Math.abs(left - right);

  // Tolerance: allow small rounding drift when the user picks dimensions derived
  // from the original aspect ratio.
  const tolerance = Math.max(1, Math.round(Math.max(left, right) * 0.001)); // 0.1%
  return diff <= tolerance;
}

async function main() {
  const [, , inputArg, widthArg, heightArg] = process.argv;

  console.log('Resizing image with parameters:');
  console.log(`  Input file: ${inputArg}`);
  console.log(`  Target width: ${widthArg}`);
  console.log(`  Target height: ${heightArg}`);

  if (!inputArg || !widthArg || !heightArg) {
    printUsageAndExit();
  }

  const width = parsePositiveInt(widthArg, 'width');
  const height = parsePositiveInt(heightArg, 'height');

  const srcPath = path.resolve(process.cwd(), inputArg);
  const outPath = buildOutputPath(srcPath, width, height);

  if (!fs.existsSync(srcPath)) {
    console.error(`Source file not found: ${srcPath}`);
    process.exit(1);
  }

  try {
    const metadata = await sharp(srcPath).metadata();
    const origWidth = metadata.width;
    const origHeight = metadata.height;

    if (!origWidth || !origHeight) {
      console.error('Could not determine original image dimensions.');
      process.exit(1);
    }

    const preserves = aspectRatioPreserved(origWidth, origHeight, width, height);
    if (!preserves) {
      console.log(`Original dimensions: ${origWidth}x${origHeight}`);
      console.log(`Target dimensions:   ${width}x${height}`);
      const proceed = await askYesNo(
        'Target dimensions do not preserve the original aspect ratio. Change the aspect ratio and resize anyway? (y/N) '
      );
      if (!proceed) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    const pipeline = sharp(srcPath).resize(width, height, {
      // If aspect ratio is preserved, just resize. If not preserved and user
      // confirmed, this will stretch to match the exact dimensions.
      fit: 'fill',
    });

    const extLower = path.extname(outPath).toLowerCase();
    if (extLower === '.png') {
      await pipeline.png().toFile(outPath);
    } else if (extLower === '.jpg' || extLower === '.jpeg') {
      await pipeline.jpeg().toFile(outPath);
    } else if (extLower === '.webp') {
      await pipeline.webp().toFile(outPath);
    } else {
      // Default: keep original format if possible.
      await pipeline.toFile(outPath);
    }

    console.log(`Resized image written to: ${outPath}`);
  } catch (err) {
    console.error('Failed to resize image:', err);
    process.exit(1);
  }
}

main();
