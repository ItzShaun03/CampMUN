/* ============================================================
   CAMP MUN — MONGO MODELS
   Every collection the portal uses is defined here exactly once.
   Accounts are split into two collections (schools vs individuals);
   a master `logins` list lets the Secretariat find who owns which
   email, and `sessions` stores rotating login tokens (30-day TTL).
   ============================================================ */

import mongoose from "mongoose";

/* ---- Registrations -------------------------------------------
   Each school gets its OWN registration collection
   ("registration_school_<slug>") and every Individual applicant
   shares one "registration_individuals" collection — the same
   one-tab-per-school layout as the Google Sheet and the Excel
   export. Models are registered on demand (cached) so one schema
   can back any number of collections.
   ------------------------------------------------------------ */
export const registrationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180, unique: true },
  school: { type: String, required: true, trim: true, maxlength: 180 },
  role: { type: String, required: true, trim: true, maxlength: 80 },
  committee: { type: String, required: true, trim: true, maxlength: 180 },
  consent: { type: Boolean, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, refPath: "userKind" },
  userKind: { type: String, enum: ["SchoolUser", "IndividualUser"] },
  sheetsDeliveredAt: Date
}, { timestamps: true });

/* Index that backs every account-scoped query: seat-limit counts
   (user + userKind) and the /mine list sorted by creation time. */
registrationSchema.index({ user: 1, userKind: 1, createdAt: 1 });

/* ---- School accounts ---------------------------------------- */
const schoolUserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180, unique: true },
  school: { type: String, required: true, trim: true, maxlength: 180 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  numDelegates: { type: String, required: true, trim: true, maxlength: 10 },
  numFaculty: { type: String, required: true, trim: true, maxlength: 10 },
  teacherName: { type: String, required: true, trim: true, maxlength: 120 },
  teacherMobile: { type: String, required: true, trim: true, maxlength: 30 },
  teacherEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

/* ---- Individual accounts ------------------------------------ */
const individualUserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180, unique: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  grade: { type: String, required: true, trim: true, maxlength: 40 },
  school: { type: String, required: true, trim: true, maxlength: 180 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  committeePreferences: { type: String, required: true, trim: true, maxlength: 3000 },
  whyIndividual: { type: String, required: true, trim: true, maxlength: 3000 },
  whyAccepted: { type: String, required: true, trim: true, maxlength: 3000 },
  experience: { type: String, required: true, trim: true, maxlength: 3000 },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

/* ---- Master login list (Secretariat lookup by email) --------
   One row per account; passwords stay hashed. Only used to answer
   "who logs in with this email?".
   ------------------------------------------------------------ */
const loginSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180, unique: true },
  passwordHash: { type: String, required: true },
  kind: { type: String, enum: ["SchoolUser", "IndividualUser"], required: true }
}, { timestamps: true });

/* ---- Sessions (login tokens; auto-expire after 30 days) -----
   Only the SHA-256 hash of each token is stored, so a database
   breach cannot be replayed to hijack sessions. The plaintext
   token lives solely with the browser. */
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  kind: { type: String, enum: ["SchoolUser", "IndividualUser"], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "kind" },
  createdAt: { type: Date, default: Date.now, expires: "30d" }
});

export const SchoolUser = mongoose.model("SchoolUser", schoolUserSchema, "school_users");
export const IndividualUser = mongoose.model("IndividualUser", individualUserSchema, "individual_users");
export const Login = mongoose.model("Login", loginSchema, "logins");
export const Session = mongoose.model("Session", sessionSchema);

export const USER_MODELS = { SchoolUser, IndividualUser };

/* ---- Registration collections (per school + one for individuals) - */
export const LEGACY_REGISTRATIONS = "registrations";
export const INDIVIDUAL_REGISTRATIONS = "registration_individuals";

const slugifySchool = (school) => {
  const slug = String(school || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "school";
};

export const registrationCollectionName = ({ school, userKind }) =>
  userKind === "IndividualUser" ? INDIVIDUAL_REGISTRATIONS : `registration_school_${slugifySchool(school)}`;

const registrationModelCache = new Map();

export const registrationModelFor = (name) => {
  if (!registrationModelCache.has(name)) {
    const modelName = `Registration_${name}`;
    registrationModelCache.set(
      name,
      mongoose.models[modelName] || mongoose.model(modelName, registrationSchema, name)
    );
  }
  return registrationModelCache.get(name);
};

export const listRegistrationCollections = async () => {
  const names = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  return names.filter((name) => name === LEGACY_REGISTRATIONS || name.startsWith("registration_"));
};

/* Move any rows left in the old single "registrations" collection into
   the per-school / individuals collections, then remove the legacy one. */
export const migrateLegacyRegistrations = async () => {
  const names = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  if (!names.includes(LEGACY_REGISTRATIONS)) return 0;

  const legacy = await mongoose.connection.db.collection(LEGACY_REGISTRATIONS).find({}).toArray();
  if (!legacy.length) {
    await mongoose.connection.db.dropCollection(LEGACY_REGISTRATIONS);
    console.log("Removed empty legacy registrations collection.");
    return 0;
  }

  let moved = 0;
  for (const doc of legacy) {
    const target = registrationCollectionName({ school: doc.school, userKind: doc.userKind || "IndividualUser" });
    const Model = registrationModelFor(target);
    await Model.init();
    const existing = await Model.findOne({ applicationId: doc.applicationId }).exec();
    if (!existing) {
      const { _id, ...rest } = doc;
      await Model.create(rest);
    }
    moved += 1;
  }
  await mongoose.connection.db.dropCollection(LEGACY_REGISTRATIONS);
  console.log(`Migrated ${legacy.length} legacy registrations into per-school / individuals collections.`);
  return moved;
};

/* ---- Small helpers shared by several routes ----------------- */
export const userKindOf = (accountType) => (accountType === "school" ? "SchoolUser" : "IndividualUser");

export const syncLogin = async (email, passwordHash, kind) => {
  try {
    await Login.findOneAndUpdate({ email }, { email, passwordHash, kind }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
  } catch (error) {
    console.warn("Could not sync login record:", error.message);
  }
};

/* Build each registration collection's index set so the schema stays
   consistent across every per-school collection, and drop the old
   single-field `user_1` index now replaced by the account compound
   index. Safe to run at boot: new collections are indexed before any
   registration arrives. */
const dropStaleUserIndex = async (model) => {
  try {
    await model.collection.dropIndex("user_1");
  } catch {
    /* index was never created (fresh collection) */
  }
};

/* Sessions now key on the hashed token (`tokenHash`). The old unique
   index on the removed `token` field would reject every session after
   the first (all missing fields collide as null), so drop it. */
const dropStaleSessionTokenIndex = async () => {
  try {
    await Session.collection.dropIndex("token_1");
  } catch {
    /* index was never created (fresh collection) */
  }
};

export const ensureRegistrationIndexes = async (names) => {
  for (const name of names) {
    if (name === LEGACY_REGISTRATIONS) continue;
    const Model = registrationModelFor(name);
    await Model.init();
    await dropStaleUserIndex(Model);
  }
};

export const ensureCollections = async () => {
  await Promise.all([
    SchoolUser.init(),
    IndividualUser.init(),
    Session.init(),
    Login.init(),
    registrationModelFor(INDIVIDUAL_REGISTRATIONS).init()
  ]);
  await dropStaleSessionTokenIndex();
  await migrateLegacyRegistrations();

  const schoolNames = (await listRegistrationCollections())
    .filter((name) => name !== LEGACY_REGISTRATIONS && name !== INDIVIDUAL_REGISTRATIONS);
  await ensureRegistrationIndexes([INDIVIDUAL_REGISTRATIONS, ...schoolNames]);

  console.log(
    `Collections ensured: school_users, individual_users, sessions, logins, registration_individuals + ${schoolNames.length} school registration collection(s) — indexes synced.`
  );
};