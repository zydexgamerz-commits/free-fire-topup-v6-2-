const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;

const UID_VERIFY_URL =
  process.env.UID_VERIFY_URL ||
  "https://proapis.hlgamingofficial.com/main/games/freefire/account/api";

const UID_VERIFY_API_KEY = process.env.UID_VERIFY_API_KEY;
const UID_VERIFY_USERUID = process.env.UID_VERIFY_USERUID;
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const SUPPORTED_REGIONS = (
  process.env.UID_SUPPORTED_REGIONS || "ind,pk,bd"
)
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const publicDir = __dirname;

/*
 * FREE RENDER STORAGE
 *
 * Render Free has an ephemeral filesystem.
 * Live data is therefore stored in Supabase.
 *
 * For local development, the app falls back to JSON files
 * if Supabase variables are not configured.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "uploads";

const localDataDir = path.join(publicDir, "data");

if (!fs.existsSync(localDataDir)) {
  fs.mkdirSync(localDataDir, { recursive: true });
}

const localPaths = {
  products: path.join(localDataDir, "products.json"),
  orders: path.join(localDataDir, "orders.json"),
  settings: path.join(localDataDir, "settings.json"),
};

function ensureLocalFile(file, fallback) {
  if (fs.existsSync(file)) return;

  const sourceFile = path.join(publicDir, path.basename(file));

  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, file);
  } else {
    fs.writeFileSync(
      file,
      JSON.stringify(fallback, null, 2)
    );
  }
}

ensureLocalFile(localPaths.products, []);
ensureLocalFile(localPaths.orders, []);

ensureLocalFile(localPaths.settings, {
  storeName: "Free Fire Top Up",
  subtitle: "Fast & Secure UID Verification",
  qrUrl: "",
  upiId: "",
  supportText: "",
});

function readLocal(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeLocal(file, value) {
  const tmp = file + ".tmp";

  fs.writeFileSync(
    tmp,
    JSON.stringify(value, null, 2)
  );

  fs.renameSync(tmp, file);
}

/* =========================
   SUPABASE STORAGE
========================= */

async function ensureSupabaseStorage() {
  if (!supabaseEnabled) return;

  const { data, error } =
    await supabase.storage.getBucket(STORAGE_BUCKET);

  if (!error && data) return;

  const result =
    await supabase.storage.createBucket(
      STORAGE_BUCKET,
      {
        public: true,
        fileSizeLimit: "6MB",
        allowedMimeTypes: [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
        ],
      }
    );

  if (
    result.error &&
    !/already exists|duplicate/i.test(
      result.error.message || ""
    )
  ) {
    console.warn(
      "Could not create Supabase storage bucket:",
      result.error.message
    );
  }
}

/* =========================
   DATABASE
========================= */

async function getData(kind, fallback) {
  if (!supabaseEnabled) {
    return readLocal(
      localPaths[kind],
      fallback
    );
  }

  const { data, error } =
    await supabase
      .from(`app_${kind}`)
      .select("data")
      .eq("id", 1)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Supabase read ${kind} failed: ${error.message}`
    );
  }

  if (!data) {
    await setData(kind, fallback);
    return fallback;
  }

  return data.data ?? fallback;
}

async function setData(kind, value) {
  if (!supabaseEnabled) {
    writeLocal(
      localPaths[kind],
      value
    );
    return;
  }

  const { error } =
    await supabase
      .from(`app_${kind}`)
      .upsert({
        id: 1,
        data: value,
        updated_at: new Date().toISOString(),
      });

  if (error) {
    throw new Error(
      `Supabase write ${kind} failed: ${error.message}`
    );
  }
}

/* =========================
   IMAGE STORAGE
========================= */

async function sendStorageImage(
  dataUrl,
  originalName
) {
  const m = String(dataUrl || "").match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i
  );

  if (!m) {
    throw new Error(
      "Only PNG, JPG, WEBP or GIF images are allowed."
    );
  }

  const mime =
    m[1].toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : m[1].toLowerCase();

  const ext =
    mime === "image/jpeg"
      ? "jpg"
      : mime.split("/")[1];

  const raw = Buffer.from(
    m[2],
    "base64"
  );

  if (raw.length > 6 * 1024 * 1024) {
    throw new Error(
      "Image must be 6 MB or smaller."
    );
  }

  const safeBase =
    String(originalName || "image")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 40) || "image";

  const fileName =
    `${Date.now().toString(36)}-` +
    `${crypto.randomBytes(6).toString("hex")}-` +
    `${safeBase}.${ext}`;

  if (supabaseEnabled) {
    const { error } =
      await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(
          fileName,
          raw,
          {
            contentType: mime,
            cacheControl: "31536000",
            upsert: false,
          }
        );

    if (error) {
      throw new Error(
        `Image storage upload failed: ${error.message}`
      );
    }

    const { data } =
      supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

    return data.publicUrl;
  }

  const localUploads =
    path.join(
      localDataDir,
      "uploads"
    );

  if (!fs.existsSync(localUploads)) {
    fs.mkdirSync(
      localUploads,
      { recursive: true }
    );
  }

  fs.writeFileSync(
    path.join(
      localUploads,
      fileName
    ),
    raw
  );

  return `/uploads/${fileName}`;
}

async function deleteStoredImage(url) {
  if (!url) return;

  if (supabaseEnabled) {
    try {
      const marker =
        `/${STORAGE_BUCKET}/`;

      const idx =
        String(url).indexOf(marker);

      if (idx >= 0) {
        const objectPath =
          String(url)
            .slice(
              idx + marker.length
            )
            .split("?")[0];

        if (objectPath) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([objectPath]);
        }
      }
    } catch {}

    return;
  }

  if (
    !String(url).startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const file =
    path.join(
      localDataDir,
      "uploads",
      path.basename(String(url))
    );

  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch {}
  }
}

/* =========================
   HTTP HELPERS
========================= */

function sendJson(
  res,
  status,
  data
) {
  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Cache-Control":
        "no-store",

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Headers":
        "Content-Type, Authorization",

      "Access-Control-Allow-Methods":
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    }
  );

  res.end(
    JSON.stringify(data)
  );
}

function sendFile(
  res,
  name,
  type
) {
  const file =
    path.join(
      publicDir,
      name
    );

  fs.readFile(
    file,
    (err, data) => {
      if (err) {
        return sendJson(
          res,
          404,
          {
            ok: false,
            message:
              "File not found.",
          }
        );
      }

      res.writeHead(
        200,
        {
          "Content-Type": type,
          "Cache-Control":
            "no-cache",
        }
      );

      res.end(data);
    }
  );
}

function readBody(
  req,
  maxBytes = 8 * 1024 * 1024
) {
  return new Promise(
    (resolve, reject) => {
      let body = "";
      let size = 0;

      req.on(
        "data",
        (chunk) => {
          size += chunk.length;

          if (size > maxBytes) {
            reject(
              new Error(
                "Request too large"
              )
            );

            req.destroy();
            return;
          }

          body += chunk.toString();
        }
      );

      req.on(
        "end",
        () => resolve(body)
      );

      req.on(
        "error",
        reject
      );
    }
  );
}

/* =========================
   ADMIN AUTHENTICATION
========================= */

function tokenFor() {
  const exp =
    Date.now() +
    1000 * 60 * 60 * 12;

  const payload =
    `admin:${exp}`;

  const sig =
    crypto
      .createHmac(
        "sha256",
        ADMIN_PASSWORD
      )
      .update(payload)
      .digest("hex");

  return Buffer.from(
    `${payload}:${sig}`
  ).toString("base64url");
}

function isAdmin(req) {
  const h =
    req.headers.authorization ||
    "";

  if (!h.startsWith("Bearer ")) {
    return false;
  }

  try {
    const raw =
      Buffer.from(
        h.slice(7),
        "base64url"
      ).toString();

    const [
      user,
      exp,
      sig,
    ] = raw.split(":");

    if (
      user !== "admin" ||
      Number(exp) < Date.now()
    ) {
      return false;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          ADMIN_PASSWORD
        )
        .update(
          `admin:${exp}`
        )
        .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(sig || ""),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

function orderId() {
  return (
    "FT" +
    Date.now()
      .toString(36)
      .toUpperCase() +
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()
  );
}

/* =========================
   REQUEST RATE LIMIT
========================= */

const requests = new Map();

function rateLimit(
  ip,
  max = 30
) {
  const now = Date.now();

  const arr =
    (
      requests.get(ip) || []
    ).filter(
      (t) =>
        now - t < 60000
    );

  if (arr.length >= max) {
    requests.set(ip, arr);
    return false;
  }

  arr.push(now);

  requests.set(
    ip,
    arr
  );

  return true;
}

/* ==================================================
   UID VERIFICATION CACHE
================================================== */

/*
 * Successful UID verifications are cached for 24 hours.
 *
 * Example:
 *
 * Customer A checks UID 123456789
 *       ↓
 * HL Gaming API is called
 *       ↓
 * Successful result is cached
 *
 * Customer B checks the same UID
 *       ↓
 * Cached result is returned
 *       ↓
 * NO additional HL Gaming API request
 *
 * IMPORTANT:
 *
 * This does NOT bypass HL Gaming's daily quota.
 * It simply prevents duplicate verification requests.
 *
 * The cache is stored in server memory, so it is cleared
 * when Render restarts the server.
 */

const UID_CACHE_TTL_MS =
  24 * 60 * 60 * 1000;

const uidCache =
  new Map();

function uidCacheKey(
  uid,
  region
) {
  return (
    `${String(
      region || "ind"
    ).toLowerCase()}:` +
    `${String(uid || "")}`
  );
}

function cleanupUidCache() {
  const now = Date.now();

  for (
    const [
      key,
      entry,
    ] of uidCache
  ) {
    if (
      !entry ||
      entry.expiresAt <= now
    ) {
      uidCache.delete(key);
    }
  }
}

/* =========================
   UID VERIFICATION
========================= */

async function verifyUid(
  uid,
  region
) {
  const normalizedUid =
    String(uid || "").trim();

  /*
   * Supports both 9-digit and 10-digit UIDs.
   */

  if (
    !/^\d{9,10}$/.test(
      normalizedUid
    )
  ) {
    return {
      status: 400,
      data: {
        verified: false,
        message:
          "UID must be 9 or 10 digits.",
      },
    };
  }

  const selected =
    String(
      region || "ind"
    ).toLowerCase();

  if (
    !SUPPORTED_REGIONS.includes(
      selected
    )
  ) {
    return {
      status: 400,
      data: {
        verified: false,
        message:
          "Selected region is not supported.",
      },
    };
  }

  if (
    !UID_VERIFY_API_KEY ||
    !UID_VERIFY_USERUID
  ) {
    return {
      status: 503,
      data: {
        verified: false,
        message:
          "UID verification is not configured on the server.",
      },
    };
  }

  /*
   * CHECK CACHE FIRST
   */

  cleanupUidCache();

  const cacheKey =
    uidCacheKey(
      normalizedUid,
      selected
    );

  const cached =
    uidCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    console.log(
      `UID cache hit: ${normalizedUid} (${selected})`
    );

    return {
      status: 200,

      data: {
        verified: true,

        verificationToken:
          crypto
            .randomBytes(24)
            .toString("hex"),

        player: {
          ...cached.player,
        },

        cached: true,
      },
    };
  }

  /*
   * CACHE MISS
   *
   * Call HL Gaming.
   */

  console.log(
    `UID API request: ${normalizedUid} (${selected})`
  );

  const url =
    new URL(
      UID_VERIFY_URL
    );

  url.searchParams.set(
    "sectionName",
    "AllData"
  );

  url.searchParams.set(
    "PlayerUid",
    normalizedUid
  );

  url.searchParams.set(
    "region",
    selected
  );

  url.searchParams.set(
    "useruid",
    UID_VERIFY_USERUID
  );

  url.searchParams.set(
    "api",
    UID_VERIFY_API_KEY
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "application/json",
          },

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      return {
        status: 502,

        data: {
          verified: false,
          message:
            "UID provider returned an error.",
        },
      };
    }

    const data =
      await response.json();

    const account =
      data?.result?.AccountInfo;

    if (
      !account?.AccountName
    ) {
      return {
        status: 404,

        data: {
          verified: false,
          message:
            "UID was not found or could not be verified.",
        },
      };
    }

    const player = {
      uid: normalizedUid,

      name:
        account.AccountName,

      level:
        account.AccountLevel ??
        null,

      likes:
        account.AccountLikes ??
        null,

      region:
        account.AccountRegion ||
        selected,

      brRank:
        account.BrMaxRank ??
        null,

      csRank:
        account.CsMaxRank ??
        null,
    };

    /*
     * SAVE SUCCESSFUL RESULT TO CACHE
     */

    uidCache.set(
      cacheKey,
      {
        player,
        expiresAt:
          Date.now() +
          UID_CACHE_TTL_MS,
      }
    );

    return {
      status: 200,

      data: {
        verified: true,

        verificationToken:
          crypto
            .randomBytes(24)
            .toString("hex"),

        player,

        cached: false,
      },
    };
  } catch (e) {
    console.error(
      "UID verification:",
      e.message
    );

    return {
      status: 502,

      data: {
        verified: false,
        message:
          "UID verification service is unavailable.",
      },
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

/* =========================
   VERIFICATION TOKENS
========================= */

const verifiedTokens =
  new Map();

function rememberVerification(
  token,
  player
) {
  verifiedTokens.set(
    token,
    {
      player,
      expires:
        Date.now() +
        15 * 60 * 1000,
    }
  );
}

function getVerification(
  token
) {
  const x =
    verifiedTokens.get(
      token
    );

  if (
    !x ||
    x.expires < Date.now()
  ) {
    verifiedTokens.delete(
      token
    );

    return null;
  }

  return x.player;
}

/* =========================
   SERVER
========================= */

const server =
  http.createServer(
    async (req, res) => {
      if (
        req.method ===
        "OPTIONS"
      ) {
        return sendJson(
          res,
          204,
          {}
        );
      }

      const u =
        new URL(
          req.url,
          `http://${req.headers.host || "localhost"}`
        );

      const ip =
        req.headers[
          "x-forwarded-for"
        ]
          ?.split(",")[0]
          ?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

      try {
        /* =========================
           HEALTH
        ========================= */

        if (
          req.method === "GET" &&
          u.pathname ===
            "/api/health"
        ) {
          return sendJson(
            res,
            200,
            {
              ok: true,

              storage:
                supabaseEnabled
                  ? "supabase"
                  : "local",

              uidVerificationConfigured:
                Boolean(
                  UID_VERIFY_API_KEY &&
                  UID_VERIFY_USERUID
                ),
            }
          );
        }

        /* =========================
           PRODUCTS
        ========================= */

        if (
          req.method === "GET" &&
          u.pathname ===
            "/api/products"
        ) {
          return sendJson(
            res,
            200,
            {
              products:
                await getData(
                  "products",
                  []
                ),
            }
          );
        }

        /* =========================
           SETTINGS
        ========================= */

        if (
          req.method === "GET" &&
          u.pathname ===
            "/api/settings"
        ) {
          const s =
            await getData(
              "settings",
              {}
            );

          return sendJson(
            res,
            200,
            {
              storeName:
                s.storeName,

              subtitle:
                s.subtitle,

              qrUrl:
                s.qrUrl,

              upiId:
                s.upiId,

              supportText:
                s.supportText,
            }
          );
        }

        /* =========================
           VERIFY UID
        ========================= */

        if (
          req.method === "POST" &&
          u.pathname ===
            "/api/verify-uid"
        ) {
          if (
            !rateLimit(ip)
          ) {
            return sendJson(
              res,
              429,
              {
                verified: false,
                message:
                  "Too many requests. Please try again later.",
              }
            );
          }

          const body =
            JSON.parse(
              await readBody(
                req
              ) || "{}"
            );

          const result =
            await verifyUid(
              body.uid,
              body.region
            );

          if (
            result.data.verified
          ) {
            rememberVerification(
              result.data
                .verificationToken,
              result.data.player
            );
          }

          return sendJson(
            res,
            result.status,
            result.data
          );
        }

        /* =========================
           ORDERS
        ========================= */

        if (
          req.method === "POST" &&
          u.pathname ===
            "/api/orders"
     
