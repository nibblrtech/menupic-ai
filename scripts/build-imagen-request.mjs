// Minimal regression harness: ensures Imagen request includes media bytes.
// Usage: node scripts/build-imagen-request.mjs

const normalizeBase64 = (input) => {
  if (typeof input !== 'string') return '';
  const dataUriPrefix = /^data:[^;]+;base64,/i;
  const cleaned = input.replace(dataUriPrefix, '').trim();
  return cleaned.replace(/\s+/g, '');
};

// Not a valid JPEG; just non-empty base64 for structural test.
const SAMPLE_BASE64 = normalizeBase64('data:image/jpeg;base64,AAECAwQFBgcICQ==');
const MIME_TYPE = 'image/jpeg';

const requestBody = {
  instances: [
    {
      prompt: 'test prompt',
      referenceImages: [
        {
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceId: 1,
          referenceImage: {
            mimeType: MIME_TYPE,
            bytesBase64Encoded: SAMPLE_BASE64,
            rawBytes: SAMPLE_BASE64,
          },
          subjectImageConfig: {
            subjectDescription: 'head shot',
            subjectType: 'SUBJECT_TYPE_PERSON',
          },
        },
      ],
    },
  ],
  parameters: {
    sampleCount: 1,
    aspectRatio: '1:1',
    personGeneration: 'allow_all',
    safetySetting: 'block_only_high',
  },
};

const ref = requestBody.instances?.[0]?.referenceImages?.[0]?.referenceImage;
const ok =
  ref &&
  ref.mimeType === MIME_TYPE &&
  typeof ref.bytesBase64Encoded === 'string' &&
  ref.bytesBase64Encoded.length > 0 &&
  typeof ref.rawBytes === 'string' &&
  ref.rawBytes.length > 0;

if (!ok) {
  console.error('FAIL: referenceImage is missing bytes.');
  console.error(JSON.stringify(requestBody, null, 2));
  process.exit(1);
}

console.log('OK: Imagen request includes reference image bytes.');
