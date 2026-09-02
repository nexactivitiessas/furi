/**
 * CONFIGURACIÓN DEL FRONTEND — Tienda Furi
 * ---------------------------------------------------------------
 * Pegá acá la URL /exec de tu Web App de Google Apps Script
 * (Implementar > Nueva implementación > Aplicación web).
 * Es lo ÚNICO que hay que tocar del frontend.
 */
window.FURI = window.FURI || {};
window.FURI.config = {
  // Ej: 'https://script.google.com/macros/s/AKfycb.../exec'
  API_URL: 'https://script.google.com/macros/s/AKfycbyXe8DFOA9M4HNjIe18p2SZvqX6I0HFEFGkg-b7q-N99_3qPEvLvlqqrTIsPsrPETxaxw/exec',

  // Cantidad de productos por página en el catálogo 
  PRODUCTOS_POR_PAGINA: 12,

  // WhatsApp: si Configuracion.WhatsApp está cargado se usa ese; esto es un fallback
  WHATSAPP_FALLBACK: ''
};
