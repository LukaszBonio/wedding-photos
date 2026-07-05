/**
 * Wedding photo/video upload backend — Google Apps Script Web App.
 * VERSION 3 — check via GET request to the deployment URL.
 */

const CODE_VERSION = 3;

const MAX_DECODED_BYTES = 25 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_DECODED_BYTES / 3) * 4 + 8;
const CACHE_TTL_SECONDS = 21600;
const MAX_CAPTION_LENGTH = 200;
const DEFAULT_MAX_UPLOADS_PER_DAY = 5000;

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const ALLOWED_VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const MAGIC_SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

// ---- Web App entry points --------------------------------------------------

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

function doGet() {
  return jsonOutput_({ status: 'ok', message: 'Wedding upload endpoint.', version: CODE_VERSION, fileId: null });
}

// ---- Photo upload ----------------------------------------------------------

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

// ---- Video chunked upload --------------------------------------------------

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
    if (!session.uri) return error_(session.error);
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
  var token = ScriptApp.getOAuthToken();
  try {
    var response = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'POST',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          'Authorization': 'Bearer ' + token,
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(totalBytes),
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      }
    );
    var code = response.getResponseCode();
    if (code === 200) {
      var allHeaders = response.getAllHeaders();
      var locationUri = null;
      for (var key in allHeaders) {
        if (key.toLowerCase() === 'location') {
          locationUri = Array.isArray(allHeaders[key]) ? allHeaders[key][0] : allHeaders[key];
          break;
        }
      }
      if (locationUri) return { uri: locationUri, error: null };
      return { uri: null, error: 'Brak nagłówka Location w odpowiedzi (HTTP 200). Nagłówki: ' + Object.keys(allHeaders).join(', ') };
    }
    var body = '';
    try { body = response.getContentText().substring(0, 300); } catch (_) {}
    return { uri: null, error: 'Drive API HTTP ' + code + ': ' + body };
  } catch (e) {
    return { uri: null, error: 'Wyjątek: ' + String(e).substring(0, 300) };
  }
}

function uploadChunkToSession_(sessionUri, chunkBytes, byteOffset, totalBytes) {
  var endByte = byteOffset + chunkBytes.length - 1;
  var contentRange = 'bytes ' + byteOffset + '-' + endByte + '/' + totalBytes;
  try {
    var response = UrlFetchApp.fetch(sessionUri, {
      method: 'PUT',
      contentType: 'application/octet-stream',
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
    return { error: 'Chunk upload HTTP ' + code + ': ' + response.getContentText().substring(0, 200) };
  } catch (e) {
    return { error: 'Chunk upload error: ' + String(e).substring(0, 200) };
  }
}

// ---- Test function (run manually in GAS editor) ----------------------------

function testDriveApiAccess() {
  var config = readConfig_();
  if (config.error) {
    Logger.log('CONFIG ERROR: ' + config.error);
    return;
  }
  Logger.log('Config OK. Folder: ' + config.folderId);

  var token = ScriptApp.getOAuthToken();
  Logger.log('Token (first 30 chars): ' + token.substring(0, 30) + '...');

  var metadata = { name: 'test_upload_delete_me.mp4', parents: [config.folderId] };
  try {
    var response = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          'Authorization': 'Bearer ' + token,
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': '1024',
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      }
    );
    Logger.log('HTTP Status: ' + response.getResponseCode());
    Logger.log('Response headers: ' + JSON.stringify(response.getAllHeaders()));
    Logger.log('Response body: ' + response.getContentText().substring(0, 500));
  } catch (e) {
    Logger.log('EXCEPTION: ' + e);
  }
}

// ---- Configuration ---------------------------------------------------------

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

// ---- Validation helpers ----------------------------------------------------

function validateStructure_(payload) {
  if (!payload || typeof payload !== 'object') return 'Brak danych.';
  if (!isNonEmptyString_(payload.token)) return 'Brak tokenu.';
  if (!isNonEmptyString_(payload.uploadId)) return 'Brak identyfikatora.';
  if (!isValidUploadId_(payload.uploadId)) return 'Nieprawidłowy identyfikator.';
  if (!isNonEmptyString_(payload.filename)) return 'Brak nazwy pliku.';
  if (!isNonEmptyString_(payload.mimeType)) return 'Brak typu pliku.';
  if (!isNonEmptyString_(payload.dataBase64)) return 'Brak danych.';
  if (payload.caption !== undefined && payload.caption !== null && typeof payload.caption !== 'string')
    return 'Nieprawidłowy opis.';
  return null;
}

function verifyToken_(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

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

function detectImageType_(bytes) {
  for (const mime in MAGIC_SIGNATURES) {
    if (matchesSignature_(bytes, MAGIC_SIGNATURES[mime])) return mime;
  }
  return null;
}

function matchesSignature_(bytes, signature) {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if ((bytes[i] & 0xff) !== signature[i]) return false;
  }
  return true;
}

function sanitizeCaption_(caption) {
  if (typeof caption !== 'string') return '';
  const cleaned = caption.replace(/[ -]/g, '').trim();
  return cleaned.length > MAX_CAPTION_LENGTH ? cleaned.substring(0, MAX_CAPTION_LENGTH) : cleaned;
}

function buildFilename_(uploadId, extension, timeZone) {
  const stamp = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd_HH-mm-ss');
  const shortId = uploadId.substring(0, 8);
  return stamp + '_' + shortId + '.' + extension;
}

function isNonEmptyString_(v) { return typeof v === 'string' && v.length > 0; }
function isValidUploadId_(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
function isDecodedSizeAllowed_(byteLength) { return byteLength <= MAX_DECODED_BYTES; }
function isBase64LengthAllowed_(length) { return length <= MAX_BASE64_LENGTH; }

// ---- Daily counter ---------------------------------------------------------

function dailyCountKey_() {
  const tz = Session.getScriptTimeZone();
  return 'cnt_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
}

function getDailyCount_(cache) {
  const raw = cache.get(dailyCountKey_());
  const n = raw ? parseInt(raw, 10) : 0;
  return isNaN(n) ? 0 : n;
}

function incrementDailyCount_(cache) {
  cache.put(dailyCountKey_(), String(getDailyCount_(cache) + 1), CACHE_TTL_SECONDS);
}

// ---- Response helpers ------------------------------------------------------

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ok_(message, fileId) {
  return jsonOutput_({ status: 'ok', message: message, fileId: fileId });
}

function error_(message) {
  return jsonOutput_({ status: 'error', message: message, fileId: null });
}
