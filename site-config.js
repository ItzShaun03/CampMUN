/*
  CAMP MUN — SINGLE SOURCE OF CONTENT
  Update dates, links, committees and resources here. Do not put a secret API
  key in this file. Payment is designed to use a secure hosted payment link.

  FEATURE FLAGS
  Enabled features are controlled in features.js — the single boolean file.
  Flip a value there and this config (and the server) respects it on reload.

  CONTENT FOLDERS
  Drop images into content/images/ and documents into content/documents/,
  or upload them from the Manage page. Every image appears in the home-page
  gallery, every document appears as a card on the Resources page. Files are
  matched to a gallery block in order. On-site uploads need features.uploads
  enabled in features.js and an ADMIN_KEY in .env.
*/

window.CAMPMUN_CONFIG = {
  /* API endpoint for registrations and accounts. Leave "" when the Node
     server serves the pages (npm start). When the pages run on a static
     host such as GitHub Pages, point this at the running server, including
     the port, e.g. "http://localhost:3000" — and add that page origin to
     CORS_ORIGIN in the server's .env so the browser accepts the requests. */
  apiBase: "http://localhost:3000",
  event: { edition: "01 / 2027", name: "The First CampMUN", dates: "20–21 February 2027", dayOne: "20", dayTwo: "21", month: "FEB", year: "2027", theme: "In an age of uncertainty, the courage to convene." },
  contact: { email: "campmun@campionschool.in", venue: "Campion School\nCooperage Road, Mumbai", instagram: "", linkedin: "" },
  committees: [
    { code: "UNGA", name: "United Nations General Assembly", topic: "Collective action in a fractured world" },
    { code: "UNSC", name: "United Nations Security Council", topic: "Safeguarding peace amid evolving conflict" },
    { code: "UNHRC", name: "United Nations Human Rights Council", topic: "Protecting dignity in the digital age" },
    { code: "ECOFIN", name: "Economic & Financial Affairs Council", topic: "Designing equitable growth for all" },
    { code: "AIPPM", name: "All India Political Parties Meet", topic: "Reimagining the social contract" },
    { code: "IPC", name: "International Press Corps", topic: "Reporting the story behind the room" }
  ],
  gallery: [
    { title: "Opening Ceremony", caption: "The hall, moments before the first gavel." },
    { title: "Committee Sessions", caption: "Focused debate in full motion." },
    { title: "Crisis & Caucuses", caption: "Informal moments, formal decisions." },
    { title: "Awards & Closing", caption: "Recognising the voices of the weekend." },
    { title: "Beyond the Room", caption: "Photographs will appear here." },
    { title: "Beyond the Room", caption: "Photographs will appear here." }
  ],
  resources: [
    { type: "GUIDE", title: "Delegate Handbook", text: "Your introduction to procedure, preparation and presence.", href: "#", available: false },
    { type: "GUIDE", title: "Rules of Procedure", text: "A clear guide to effective and respectful debate.", href: "#", available: false },
    { type: "BRIEF", title: "Committee Background Guides", text: "The questions, context and detail behind every agenda.", href: "#", available: false },
    { type: "INFO", title: "Conference Policies", text: "Essential information for delegates, schools and guardians.", href: "#", available: false }
  ]
};
