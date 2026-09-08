// ============================================================
// Google Apps Script — Absensi Stand SI UNCAL
// Cara deploy: lihat PANDUAN_SETUP.md di folder ini
// ============================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Buat header jika baris pertama masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Nama", "Rating", "User Agent"]);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#10b981").setFontColor("#ffffff");
    }

    var waktu  = new Date();
    var nama   = String(data.nama || "-").substring(0, 80);
    var rating = Number(data.rating) || 0;
    var ua     = String(data.userAgent || "-").substring(0, 120);

    // Validasi rating 1-5
    if (rating < 1 || rating > 5) rating = 0;

    sheet.appendRow([waktu, nama, rating, ua]);

    return buildResponse({ status: "ok" });
  } catch (err) {
    return buildResponse({ status: "error", message: err.message });
  }
}

function doGet(e) {
  try {
    var action = e.parameter && e.parameter.action;

    if (action === "count") {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      // -1 untuk header row
      var total = Math.max(0, sheet.getLastRow() - 1);
      return buildResponse({ count: total });
    }

    return buildResponse({ status: "ok", message: "Absensi SI UNCAL API" });
  } catch (err) {
    return buildResponse({ status: "error", message: err.message });
  }
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
