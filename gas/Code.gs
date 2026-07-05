/**
 * Wedding photo upload backend — Google Apps Script Web App.
 *
 * Deployment: Execute as = Me (USER_DEPLOYING), Access = Anyone (ANYONE_ANONYMOUS).
 * Transport: the client sends POST with Content-Type text/plain; the body is a
 * JSON string. GAS cannot answer a CORS preflight, so the client uses only a
 * "simple request" (no custom headers, text/plain). Base64 image data travels
 * inside the JSON (~33% overhead, accepted consciously).
 *
 * doPost ALWAYS returns HTTP 200 with a JSON body { status, message, fileId }.
 * ContentService cannot set an HTTP status code, so the client decides
 * success/failure from the `status` field. Real infrastructure errors
 * (429 / 5xx / timeouts) never reach this code — the client retries those.
 *
 * Configuration lives ONLY in Script Properties (no hardcoding):
 *   GOOGLE_DRIVE_FOLDER_ID  (required) target folder id
 *   UPLOAD_TOKEN            (required) static spam-filter token
 *   EVENT_END_DATE         (required) e.g. "2026-09-15" — endpoint dies after it
 *   MAX_UPLOADS_PER_DAY    (optional) soft anti-spam cap, default below
 *
 * All code comments are in English; guest-facing/log messages are in Polish.
 */

// ---- Fixed limits (not configurable) ---------------------------------------

/** Maximum allowed image size AFTER Base64 decode. */
const MAX_DECODED_BYTES = 25 * 1024 * 1024; // 25 MB
/** Cheap pre-decode guard: max length of the Base64 string (~4/3 of bytes). */
const MAX_BASE64_LENGTH = Math.ceil(MAX_DECODED_BYTES / 3) * 4 + 8;
/** CacheService maximum TTL. Used for dedup entries and the daily counter. */
const CACHE_TTL_SECONDS = 21600; // 6 h
/** Caption hard cap. */
const MAX_CAPTION_LENGTH = 200;
/** Default soft daily upload cap (spam mitigation only). */
const DEFAULT_MAX_UPLOADS_PER_DAY = 5000;

/** Allowed image MIME types mapped to the on-disk file extension. */
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Allowed video MIME types mapped to the on-disk file extension. */
const ALLOWED_VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** Byte signatures (magic numbers), values 0..255, per MIME type. */
const MAGIC_SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

// ---- Web App entry points --------------------------------------------------

/**
 * Handles a guest photo upload. See the ordered pipeline inline.
 * @param {Object} e Apps Script POST event.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    var config = readConfig_();
    if (config.error) {
      console.error('Config error: ' + config.error);
      return error_('Serwer nie jest poprawnie skonfigurowany.');
    }

    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return error_('Brak danych żądania.');
    }
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return error_('Nieprawidłowy format danych.');
    }

    var action = payload.action || 'uploadPhoto';
    if (action === 'uploadVideoChunk') {
      return handleVideoChunk_(payload, config);
    }
    return handlePhotoUpload_(payload, config);
  } catch (err) {
    console.error('doPost error: ' + (err && err.stack ? err.stack : err));
    return error_('Błąd serwera podczas zapisu.');
  }
}

/** Handles a single-request photo upload (existing behaviour). */
function handlePhotoUpload_(payload, config) {
  var structureError = validateStructure_(payload);
  if (structureError) return error_(structureError);

  if (!verifyToken_(payload.token, config.uploadToken))
    return error_('Nieprawidłowy token.');
  if (!isEventOpen_(config.eventEndDate, new Date()))
    return error_('Zbieranie zdjęć zostało zakończone.');

  var cache = CacheService.getScriptCache();
  var dedupKey = 'up_' + payload.uploadId;
  var existingFileId = cache.get(dedupKey);
  if (existingFileId) return ok_('Zdjęcie zostało już przyjęte.', existingFileId);

  if (!isBase64LengthAllowed_(payload.dataBase64.length))
    return error_('Plik jest zbyt duży.');
  var bytes = Utilities.base64Decode(payload.dataBase64);
  if (!isDecodedSizeAllowed_(bytes.length))
    return error_('Plik jest zbyt duży.');
  var detectedType = detectImageType_(bytes);
  if (!detectedType) return error_('Nieobsługiwany format pliku.');
  if (detectedType !== payload.mimeType)
    return error_('Typ pliku nie zgadza się z zawartością.');

  var caption = sanitizeCaption_(payload.caption);
  if (getDailyCount_(cache) >= config.maxUploadsPerDay)
    return error_('Dzienny limit został osiągnięty.');

  var folder = DriveApp.getFolderById(config.folderId);
  var extension = ALLOWED_TYPES[detectedType];
  var filename = buildFilename_(payload.uploadId, extension, config.timeZone);
  var blob = Utilities.newBlob(bytes, detectedType, filename);
  var file = folder.createFile(blob);

  if (caption) file.setDescription(caption);
  var fileId = file.getId();
  cache.put(dedupKey, fileId, CACHE_TTL_SECONDS);
  incrementDailyCount_(cache);
  return ok_('Zdjęcie zapisane.', fileId);
}

// ---- Video chunked upload (Drive API resumable) ---------------------------

/**
 * Handles one chunk of a multi-part video upload. The first chunk (index 0)
 * creates a Drive API resumable session; subsequent chunks continue it.
 * The session URI is cached for up to 6 h (CACHE_TTL_SECONDS).
 */
function handleVideoChunk_(payload, config) {
  var err = validateVideoChunkStructure_(payload);
  if (err) return error_(err);

  if (!verifyToken_(payload.token, config.uploadToken))
    return error_('Nieprawidłowy token.');
  if (!isEventOpen_(config.eventEndDate, new Date()))
    return error_('Zbieranie zdjęć zostało zakończone.');
  if (!ALLOWED_VIDEO_TYPES[payload.mimeType])
    return error_('Nieobsługiwany format wideo.');

  var cache = CacheService.getScriptCache();
  var dedupKey = 'up_' + payload.uploadId;
  var sessionKey = 'vs_' + payload.uploadId;

  var existingFileId = cache.get(dedupKey);
  if (existingFileId) return ok_('Film został już przesłany.', existingFileId);

  var chunkBytes = Utilities.base64Decode(payload.dataBase64);
  var byteOffset = payload.byteOffset;
  var totalBytes = payload.totalBytes;
  var isLastChunk = (byteOffset + chunkBytes.length) >= totalBytes;

  var sessionUri = cache.get(sessionKey);
  if (!sessionUri) {
    var ext = ALLOWED_VIDEO_TYPES[payload.mimeType];
    var filename = buildFilename_(payload.uploadId, ext, config.timeZone);
    var session = createResumableSession_(config.folderId, filename, payload.mimeType, totalBytes);
    if (!session.uri) return error_(session.error || 'Nie udało się utworzyć sesji przesyłania.');
    sessionUri = session.uri;
    cache.put(sessionKey, sessionUri, CACHE_TTL_SECONDS);
  }

  var result = uploadChunkToSession_(sessionUri, chunkBytes, byteOffset, totalBytes);
  if (result.error) return error_(result.error);

  if (isLastChunk && result.fileId) {
    var caption = sanitizeCaption_(payload.caption);
    if (caption) {
      try { DriveApp.getFileById(result.fileId).setDescription(caption); } catch (_) {}
    }
    cache.put(dedupKey, result.fileId, CACHE_TTL_SECONDS);
    cache.remove(sessionKey);
    incrementDailyCount_(cache);
    return ok_('Film zapisany.', result.fileId);
  }

  return jsonOutput_({
    status: 'ok',
    message: 'Chunk ' + (payload.chunkIndex + 1) + ' przesłany.',
    fileId: null,
    chunkIndex: payload.chunkIndex,
  });
}

function validateVideoChunkStructure_(p) {
  if (!p || typeof p !== 'object') return 'Brak danych.';
  if (!isNonEmptyString_(p.token)) return 'Brak tokenu.';
  if (!isNonEmptyString_(p.uploadId)) return 'Brak identyfikatora.';
  if (!isValidUploadId_(p.uploadId)) return 'Nieprawidłowy identyfikator.';
  if (!isNonEmptyString_(p.filename)) return 'Brak nazwy pliku.';
  if (!isNonEmptyString_(p.mimeType)) return 'Brak typu pliku.';
  if (!isNonEmptyString_(p.dataBase64)) return 'Brak danych.';
  if (typeof p.chunkIndex !== 'number') return 'Brak indeksu chunka.';
  if (typeof p.totalBytes !== 'number' || p.totalBytes <= 0) return 'Brak rozmiaru pliku.';
  if (typeof p.byteOffset !== 'number') return 'Brak offsetu.';
  return null;
}

function createResumableSession_(folderId, filename, mimeType, totalBytes) {
  var metadata = { name: filename, parents: [folderId] };
  try {
    var response = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(totalBytes),
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      }
    );
    var code = response.getResponseCode();
    if (code === 200) {
      var headers = response.getHeaders();
      return { uri: headers['Location'] || headers['location'] || null, error: null };
    }
    var detail = 'Drive API HTTP ' + code;
    try { detail += ': ' + response.getContentText().substring(0, 200); } catch (_) {}
    console.error('createResumableSession_: ' + detail);
    return { uri: null, error: detail };
  } catch (e) {
    var msg = 'createResumableSession_ exception: ' + e;
    console.error(msg);
    return { uri: null, error: msg };
  }
}

function uploadChunkToSession_(sessionUri, chunkBytes, byteOffset, totalBytes) {
  var endByte = byteOffset + chunkBytes.length - 1;
  var contentRange = 'bytes ' + byteOffset + '-' + endByte + '/' + totalBytes;
  try {
    var response = UrlFetchApp.fetch(sessionUri, {
      method: 'PUT',
      headers: { 'Content-Range': contentRange },
      payload: chunkBytes,
      muteHttpExceptions: true,
    });
    var code = response.getResponseCode();
    if (code === 200 || code === 201) {
      var data = JSON.parse(response.getContentText());
      return { fileId: data.id };
    }
    if (code === 308) return { fileId: null };
    console.error('uploadChunkToSession_ HTTP ' + code + ': ' + response.getContentText());
    return { error: 'Błąd przesyłania (HTTP ' + code + ').' };
  } catch (e) {
    console.error('uploadChunkToSession_ error: ' + e);
    return { error: 'Błąd sieci podczas przesyłania.' };
  }
}

/**
 * Neutral response for accidental GET visits (e.g. opening the URL directly).
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doGet() {
  return ok_('Wedding photo upload endpoint.', null);
}

// ---- Configuration ---------------------------------------------------------

/**
 * Reads and validates configuration from Script Properties.
 * @return {Object} config or { error } on misconfiguration.
 */
function readConfig_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('GOOGLE_DRIVE_FOLDER_ID');
  const uploadToken = props.getProperty('UPLOAD_TOKEN');
  const eventEndDate = props.getProperty('EVENT_END_DATE');
  const maxRaw = props.getProperty('MAX_UPLOADS_PER_DAY');

  if (!folderId) return { error: 'GOOGLE_DRIVE_FOLDER_ID missing' };
  if (!uploadToken) return { error: 'UPLOAD_TOKEN missing' };
  if (!eventEndDate) return { error: 'EVENT_END_DATE missing' };

  const maxParsed = maxRaw ? parseInt(maxRaw, 10) : DEFAULT_MAX_UPLOADS_PER_DAY;
  const maxUploadsPerDay =
    isNaN(maxParsed) || maxParsed <= 0 ? DEFAULT_MAX_UPLOADS_PER_DAY : maxParsed;

  return {
    folderId: folderId,
    uploadToken: uploadToken,
    eventEndDate: eventEndDate,
    maxUploadsPerDay: maxUploadsPerDay,
    timeZone: Session.getScriptTimeZone(),
  };
}

// ---- Validation helpers (pure) ---------------------------------------------

/**
 * Validates the request payload structure.
 * @param {*} payload Parsed JSON body.
 * @return {?string} Polish error message, or null when valid.
 */
function validateStructure_(payload) {
  if (!payload || typeof payload !== 'object') return 'Brak danych.';
  if (!isNonEmptyString_(payload.token)) return 'Brak tokenu.';
  if (!isNonEmptyString_(payload.uploadId)) return 'Brak identyfikatora.';
  if (!isValidUploadId_(payload.uploadId)) return 'Nieprawidłowy identyfikator.';
  if (!isNonEmptyString_(payload.filename)) return 'Brak nazwy pliku.';
  if (!isNonEmptyString_(payload.mimeType)) return 'Brak typu pliku.';
  if (!isNonEmptyString_(payload.dataBase64)) return 'Brak danych zdjęcia.';
  if (
    payload.caption !== undefined &&
    payload.caption !== null &&
    typeof payload.caption !== 'string'
  ) {
    return 'Nieprawidłowy opis.';
  }
  return null;
}

/**
 * Constant-time token comparison (avoids trivial timing leaks).
 * @param {*} provided
 * @param {*} expected
 * @return {boolean}
 */
function verifyToken_(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Whether the event is still accepting uploads at `now`.
 * Date-only values are treated as inclusive end-of-day in the project timezone.
 * Invalid/missing config fails closed (returns false).
 * @param {string} endDateStr
 * @param {Date} now
 * @return {boolean}
 */
function isEventOpen_(endDateStr, now) {
  if (!endDateStr) return false;
  let endMoment;
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    endMoment = new Date(endDateStr + 'T23:59:59');
  } else {
    endMoment = new Date(endDateStr);
  }
  if (isNaN(endMoment.getTime())) return false;
  return now.getTime() <= endMoment.getTime();
}

/**
 * Detects the image type from the byte signature.
 * @param {number[]} bytes Signed or unsigned byte array.
 * @return {?string} MIME type or null when unrecognised.
 */
function detectImageType_(bytes) {
  for (const mime in MAGIC_SIGNATURES) {
    if (matchesSignature_(bytes, MAGIC_SIGNATURES[mime])) return mime;
  }
  return null;
}

/**
 * @param {number[]} bytes
 * @param {number[]} signature Values 0..255.
 * @return {boolean}
 */
function matchesSignature_(bytes, signature) {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    // Utilities.base64Decode returns signed bytes; normalise to 0..255.
    if ((bytes[i] & 0xff) !== signature[i]) return false;
  }
  return true;
}

/**
 * Sanitizes a guest caption: strip control chars, trim, cap at 200.
 * @param {*} caption
 * @return {string}
 */
function sanitizeCaption_(caption) {
  if (typeof caption !== 'string') return '';
  const cleaned = caption.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.length > MAX_CAPTION_LENGTH ? cleaned.substring(0, MAX_CAPTION_LENGTH) : cleaned;
}

/**
 * Builds the deterministic filename: YYYY-MM-DD_HH-mm-ss_<8 chars>.<ext>
 * @param {string} uploadId
 * @param {string} extension
 * @param {string} timeZone
 * @return {string}
 */
function buildFilename_(uploadId, extension, timeZone) {
  const stamp = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd_HH-mm-ss');
  const shortId = uploadId.substring(0, 8);
  return stamp + '_' + shortId + '.' + extension;
}

/** @param {*} v @return {boolean} */
function isNonEmptyString_(v) {
  return typeof v === 'string' && v.length > 0;
}

/** @param {string} v @return {boolean} */
function isValidUploadId_(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** @param {number} byteLength @return {boolean} */
function isDecodedSizeAllowed_(byteLength) {
  return byteLength <= MAX_DECODED_BYTES;
}

/** @param {number} length @return {boolean} */
function isBase64LengthAllowed_(length) {
  return length <= MAX_BASE64_LENGTH;
}

// ---- Daily counter (soft, best-effort) -------------------------------------

/** @return {string} Cache key for today's counter (project timezone). */
function dailyCountKey_() {
  const tz = Session.getScriptTimeZone();
  return 'cnt_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
}

/**
 * @param {GoogleAppsScript.Cache.Cache} cache
 * @return {number}
 */
function getDailyCount_(cache) {
  const raw = cache.get(dailyCountKey_());
  const n = raw ? parseInt(raw, 10) : 0;
  return isNaN(n) ? 0 : n;
}

/** @param {GoogleAppsScript.Cache.Cache} cache */
function incrementDailyCount_(cache) {
  cache.put(dailyCountKey_(), String(getDailyCount_(cache) + 1), CACHE_TTL_SECONDS);
}

// ---- Response helpers ------------------------------------------------------

/**
 * @param {Object} obj
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** @param {string} message @param {?string} fileId */
function ok_(message, fileId) {
  return jsonOutput_({ status: 'ok', message: message, fileId: fileId });
}

/** @param {string} message */
function error_(message) {
  return jsonOutput_({ status: 'error', message: message, fileId: null });
}
