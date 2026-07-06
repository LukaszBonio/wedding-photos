/**
 * Wedding photo upload backend — Google Apps Script Web App.
 * VERSION 9 — content-hash dedup (MD5) + gallery thumbnails.
 */

var CODE_VERSION = 9;
var RECENT_PHOTOS_COUNT = 12;
var THUMBNAIL_SIZE = 200;

var MAX_DECODED_BYTES = 50 * 1024 * 1024;
var MAX_BASE64_LENGTH = Math.ceil(MAX_DECODED_BYTES / 3) * 4 + 8;
var CACHE_TTL_SECONDS = 21600;
var MAX_CAPTION_LENGTH = 200;
var DEFAULT_MAX_UPLOADS_PER_DAY = 500;

var ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

var MAGIC_SIGNATURES = {
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

    if (payload.action === 'listRecent') {
      return handleListRecent_(payload, config);
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

// ---- Recent photos gallery ------------------------------------------------

function handleListRecent_(payload, config) {
  if (!verifyToken_(payload.token, config.uploadToken))
    return error_('Nieprawidłowy token.');

  var folder = DriveApp.getFolderById(config.folderId);
  var files = folder.getFilesByType(MimeType.JPEG);
  var items = [];

  while (files.hasNext() && items.length < 100) {
    var f = files.next();
    items.push({ file: f, date: f.getDateCreated() });
  }

  var pngFiles = folder.getFilesByType(MimeType.PNG);
  while (pngFiles.hasNext() && items.length < 100) {
    var p = pngFiles.next();
    items.push({ file: p, date: p.getDateCreated() });
  }

  items.sort(function (a, b) { return b.date.getTime() - a.date.getTime(); });
  items = items.slice(0, RECENT_PHOTOS_COUNT);

  var photos = [];
  for (var i = 0; i < items.length; i++) {
    try {
      var thumb = items[i].file.getThumbnail();
      var b64 = Utilities.base64Encode(thumb.getBytes());
      var mime = thumb.getContentType() || 'image/png';
      photos.push({
        id: items[i].file.getId(),
        name: items[i].file.getName(),
        date: items[i].date.toISOString(),
        thumbnail: 'data:' + mime + ';base64,' + b64,
      });
    } catch (thumbErr) {
      console.warn('Thumbnail error for ' + items[i].file.getName() + ': ' + thumbErr);
    }
  }

  return jsonOutput_({ status: 'ok', photos: photos });
}

// ---- Photo upload ----------------------------------------------------------

function handlePhotoUpload_(payload, config) {
  var structureError = validateStructure_(payload);
  if (structureError) return error_(structureError);

  if (!verifyToken_(payload.token, config.uploadToken))
    return error_('Nieprawidłowy token.');
  if (!isEventOpen_(config.eventEndDate, new Date()))
    return error_('Zbieranie zdjęć zostało zakończone.');

  var dedupFileId = getDedupFileId_(payload.uploadId);
  if (dedupFileId) return ok_('Zdjęcie zostało już przyjęte.', dedupFileId);

  var cache = CacheService.getScriptCache();

  if (!isBase64LengthAllowed_(payload.dataBase64.length))
    return error_('Plik jest zbyt duży.');
  var bytes = Utilities.base64Decode(payload.dataBase64);
  if (!isDecodedSizeAllowed_(bytes.length))
    return error_('Plik jest zbyt duży.');
  var detectedType = detectImageType_(bytes);
  if (!detectedType) return error_('Nieobsługiwany format pliku.');
  if (detectedType !== payload.mimeType)
    return error_('Typ pliku nie zgadza się z zawartością.');

  var contentHash = computeContentHash_(bytes);
  var existingByHash = getContentHashFileId_(contentHash);
  if (existingByHash) {
    setDedupFileId_(payload.uploadId, existingByHash);
    return ok_('To zdjęcie zostało już wcześniej przesłane.', existingByHash);
  }

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
  setDedupFileId_(payload.uploadId, fileId);
  setContentHashFileId_(contentHash, fileId);
  incrementDailyCount_(cache);
  return ok_('Zdjęcie zapisane.', fileId);
}

// ---- Test function (run manually in GAS editor) ----------------------------

function testDriveAccess() {
  var config = readConfig_();
  if (config.error) {
    Logger.log('CONFIG ERROR: ' + config.error);
    return;
  }
  Logger.log('Config OK. Folder: ' + config.folderId);

  try {
    var folder = DriveApp.getFolderById(config.folderId);
    Logger.log('Folder name: ' + folder.getName());
    var testBlob = Utilities.newBlob('test', 'text/plain', 'test_delete_me.txt');
    var file = folder.createFile(testBlob);
    Logger.log('Test file created: ' + file.getId());
    file.setTrashed(true);
    Logger.log('Test file trashed. DriveApp works correctly!');
  } catch (e) {
    Logger.log('EXCEPTION: ' + e);
  }
}

// ---- Configuration ---------------------------------------------------------

function readConfig_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('GOOGLE_DRIVE_FOLDER_ID');
  var uploadToken = props.getProperty('UPLOAD_TOKEN');
  var eventEndDate = props.getProperty('EVENT_END_DATE');
  var maxRaw = props.getProperty('MAX_UPLOADS_PER_DAY');

  if (!folderId) return { error: 'GOOGLE_DRIVE_FOLDER_ID missing' };
  if (!uploadToken) return { error: 'UPLOAD_TOKEN missing' };
  if (!eventEndDate) return { error: 'EVENT_END_DATE missing' };

  var maxParsed = maxRaw ? parseInt(maxRaw, 10) : DEFAULT_MAX_UPLOADS_PER_DAY;
  var maxUploadsPerDay =
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
  var mismatch = 0;
  for (var i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

function isEventOpen_(endDateStr, now) {
  if (!endDateStr) return false;
  var endMoment;
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    endMoment = new Date(endDateStr + 'T23:59:59');
  } else {
    endMoment = new Date(endDateStr);
  }
  if (isNaN(endMoment.getTime())) return false;
  return now.getTime() <= endMoment.getTime();
}

function detectImageType_(bytes) {
  for (var mime in MAGIC_SIGNATURES) {
    if (matchesSignature_(bytes, MAGIC_SIGNATURES[mime])) return mime;
  }
  return null;
}

function matchesSignature_(bytes, signature) {
  if (bytes.length < signature.length) return false;
  for (var i = 0; i < signature.length; i++) {
    if ((bytes[i] & 0xff) !== signature[i]) return false;
  }
  return true;
}

function sanitizeCaption_(caption) {
  if (typeof caption !== 'string') return '';
  var cleaned = "";
  for (var i = 0; i < caption.length; i++) { var c = caption.charCodeAt(i); if (c > 31 && c !== 127) cleaned += caption[i]; }
  cleaned = cleaned.trim();
  return cleaned.length > MAX_CAPTION_LENGTH ? cleaned.substring(0, MAX_CAPTION_LENGTH) : cleaned;
}

function buildFilename_(uploadId, extension, timeZone) {
  var stamp = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd_HH-mm-ss');
  var shortId = uploadId.substring(0, 8);
  return stamp + '_' + shortId + '.' + extension;
}

function isNonEmptyString_(v) { return typeof v === 'string' && v.length > 0; }
function isValidUploadId_(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
function isDecodedSizeAllowed_(byteLength) { return byteLength <= MAX_DECODED_BYTES; }
function isBase64LengthAllowed_(length) { return length <= MAX_BASE64_LENGTH; }

// ---- Dedup (PropertiesService — no TTL, survives CacheService expiry) ------

function getDedupFileId_(uploadId) {
  return PropertiesService.getScriptProperties().getProperty('dup_' + uploadId);
}

function setDedupFileId_(uploadId, fileId) {
  PropertiesService.getScriptProperties().setProperty('dup_' + uploadId, fileId);
}

// ---- Content-hash dedup (MD5 of file bytes) --------------------------------

function computeContentHash_(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = (digest[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function getContentHashFileId_(hash) {
  return PropertiesService.getScriptProperties().getProperty('chash_' + hash);
}

function setContentHashFileId_(hash, fileId) {
  PropertiesService.getScriptProperties().setProperty('chash_' + hash, fileId);
}

// ---- Daily counter ---------------------------------------------------------

function dailyCountKey_() {
  var tz = Session.getScriptTimeZone();
  return 'cnt_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
}

function getDailyCount_(cache) {
  var raw = cache.get(dailyCountKey_());
  var n = raw ? parseInt(raw, 10) : 0;
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
