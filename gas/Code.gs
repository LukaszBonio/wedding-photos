/**
 * Wedding photo/video upload backend — Google Apps Script Web App.
 * VERSION 5 — chunked video via DriveApp temp files (no UrlFetchApp).
 */

var CODE_VERSION = 5;

var MAX_DECODED_BYTES = 50 * 1024 * 1024;
var MAX_BASE64_LENGTH = Math.ceil(MAX_DECODED_BYTES / 3) * 4 + 8;
var CACHE_TTL_SECONDS = 21600;
var MAX_CAPTION_LENGTH = 200;
var DEFAULT_MAX_UPLOADS_PER_DAY = 5000;

var ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

var ALLOWED_VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
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

// ---- Video chunked upload (temp files in Drive) ----------------------------

function handleVideoChunk_(payload, config) {
  if (!payload || typeof payload !== 'object') return error_('Brak danych.');
  if (!isNonEmptyString_(payload.token)) return error_('Brak tokenu.');
  if (!isNonEmptyString_(payload.uploadId)) return error_('Brak identyfikatora.');
  if (!isValidUploadId_(payload.uploadId)) return error_('Nieprawidłowy identyfikator.');
  if (!isNonEmptyString_(payload.dataBase64)) return error_('Brak danych.');
  if (!isNonEmptyString_(payload.mimeType)) return error_('Brak typu pliku.');
  if (typeof payload.chunkIndex !== 'number') return error_('Brak indeksu.');
  if (typeof payload.totalChunks !== 'number' || payload.totalChunks <= 0) return error_('Brak liczby części.');

  if (!verifyToken_(payload.token, config.uploadToken))
    return error_('Nieprawidłowy token.');
  if (!isEventOpen_(config.eventEndDate, new Date()))
    return error_('Zbieranie zdjęć zostało zakończone.');
  if (!ALLOWED_VIDEO_TYPES[payload.mimeType])
    return error_('Nieobsługiwany format wideo.');

  var cache = CacheService.getScriptCache();
  var dedupKey = 'up_' + payload.uploadId;
  var existingFileId = cache.get(dedupKey);
  if (existingFileId) return ok_('Film został już przesłany.', existingFileId);

  var chunkBytes = Utilities.base64Decode(payload.dataBase64);
  var folder = DriveApp.getFolderById(config.folderId);

  var tempName = '_tmp_' + payload.uploadId + '_' + payload.chunkIndex;
  var tempBlob = Utilities.newBlob(chunkBytes, 'application/octet-stream', tempName);
  var tempFile = folder.createFile(tempBlob);

  var chunksKey = 'vc_' + payload.uploadId;
  var chunksJson = cache.get(chunksKey);
  var chunks = chunksJson ? JSON.parse(chunksJson) : {};
  chunks[String(payload.chunkIndex)] = tempFile.getId();
  cache.put(chunksKey, JSON.stringify(chunks), CACHE_TTL_SECONDS);

  var isLastChunk = payload.chunkIndex === payload.totalChunks - 1;

  if (!isLastChunk) {
    return jsonOutput_({
      status: 'ok',
      message: 'Część ' + (payload.chunkIndex + 1) + '/' + payload.totalChunks + ' przesłana.',
      fileId: null,
    });
  }

  var allBytes = [];
  for (var i = 0; i < payload.totalChunks; i++) {
    var fid = chunks[String(i)];
    if (!fid) return error_('Brakuje części ' + (i + 1) + '.');
    var tf = DriveApp.getFileById(fid);
    var tb = tf.getBlob().getBytes();
    for (var j = 0; j < tb.length; j++) {
      allBytes.push(tb[j]);
    }
    tf.setTrashed(true);
  }

  var ext = ALLOWED_VIDEO_TYPES[payload.mimeType] || 'mp4';
  var filename = buildFilename_(payload.uploadId, ext, config.timeZone);
  var caption = sanitizeCaption_(payload.caption);
  var finalBlob = Utilities.newBlob(allBytes, payload.mimeType, filename);
  var file = folder.createFile(finalBlob);

  if (caption) file.setDescription(caption);
  var fileId = file.getId();
  cache.put(dedupKey, fileId, CACHE_TTL_SECONDS);
  cache.remove(chunksKey);
  incrementDailyCount_(cache);
  return ok_('Film zapisany.', fileId);
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
