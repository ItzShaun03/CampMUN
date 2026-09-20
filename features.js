/*
  CAMP MUN — FEATURE FLAGS  (the single boolean control file)

  Flip any value between true and false to enable or disable that
  function across the whole site. This one file controls everywhere:
  the browser pages AND the server APIs.

    "auth"          : require a School or Individual account before registering
    "registrations" : allow the online registration form and register links
    "threeD"        : show the animated 3D ambient hero on the home page
    "gallery"       : show the photo gallery on the home page
    "resources"     : show the resources / document section
    "uploads"       : enable the Manage page for uploading images and PDFs
*/
window.CAMPMUN_FEATURES = {
  "auth": true,
  "registrations": true,
  "threeD": true,
  "gallery": true,
  "resources": true,
  "uploads": true
};
