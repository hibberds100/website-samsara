import Stripe from "stripe";

export interface Env {
  STRIPE_SECRET_KEY: string;
  // Optional but recommended later (webhooks)
  STRIPE_WEBHOOK_SECRET?: string;

  // Optional: set this to your live site origin for tighter CORS
  // e.g. https://hibberds100.github.io
  ALLOWED_ORIGIN?: string;
}

type CartItem = {
  slug: string;
  title?: string;
  size: string;
  price: number; // we will NOT trust this client value
  qty: number;
  image?: string;
};

type CreateSessionBody = {
  items: CartItem[];
  shipCountry?: "PT" | "ES" | "EU" | "UK" | "US" | "ROW";
  lang?: "en" | "pt";
  // Optional: pass your site base if you want (otherwise origin is used)
  origin?: string;
};

const SHIPPING_RULES: Record<string, { perItem: number; min: number }> = {
  PT: { perItem: 5.95, min: 0 },
  ES: { perItem: 10.95, min: 0 },
  EU: { perItem: 16.95, min: 0 },
  UK: { perItem: 25.95, min: 0 },
  US: { perItem: 40, min: 0 },
  ROW: { perItem: 65, min: 0 },
};

// ✅ IMPORTANT: Server-trusted price catalog (edit this to match your products)
// Key format: `${slug}__${sizeLabel}`
const PRICE_CATALOG_EUR: Record<string, number> = {
  // Chopping board examples (edit sizes/labels to match EXACTLY what you store in cart.size)
  "walnut-cherry-board__20x15cm - Small": 50,
  "walnut-cherry-board__30x20cm - Medium": 65,
  "walnut-cherry-board__42x27cm - Large": 75,
  "walnut-cherry-board__60x32cm - X-Large": 95,

  "oak-walnut-padauk-chopping-board__20x15cm - Small": 50,
  "oak-walnut-padauk-chopping-board__30x20cm - Medium": 65,
  "oak-walnut-padauk-chopping-board__42x27cm - Large": 75,
  "oak-walnut-padauk-chopping-board__60x32cm - X-Large": 95,

  "padauk-oak-contrast-chopping-board__20x15cm - Small": 50,
  "padauk-oak-contrast-chopping-board__30x20cm - Medium": 65,
  "padauk-oak-contrast-chopping-board__42x27cm - Large": 75,
  "padauk-oak-contrast-chopping-board__60x32cm - X-Large": 95,

  "cherry-oak-walnut-contrast-chopping-board__20x15cm - Small": 50,
  "cherry-oak-walnut-contrast-chopping-board__30x20cm - Medium": 65,
  "cherry-oak-walnut-contrast-chopping-board__42x27cm - Large": 75,
  "cherry-oak-walnut-contrast-chopping-board__60x32cm - X-Large": 95,

  "oak-walnut-contrast-chopping-board__20x15cm - Small": 50,
  "oak-walnut-contrast-chopping-board__30x20cm - Medium": 65,
  "oak-walnut-contrast-chopping-board__42x27cm - Large": 75,
  "oak-walnut-contrast-chopping-board__60x32cm - X-Large": 95,

  // Serving board example
  "walnut-serving-board__50x25cm - Medium": 55,
  "walnut-serving-board__75x40cm - Large": 75,
  "walnut-serving-board__110x45cm - X-Large": 95,

  // End Grain Examples
  "walnut-end-grain-butcher-block__30x20x4cm - Medium": 62,
  "walnut-end-grain-butcher-block__42x29x4cm - Large": 85,
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

function getAllowedOrigin(req: Request, env: Env) {
  // Prefer explicit env var if set, otherwise allow the request Origin.
  // In production, you can lock it down by setting ALLOWED_ORIGIN.
  const o = req.headers.get("Origin") || "";
  return env.ALLOWED_ORIGIN || o || "*";
}

function toCentsEUR(amount: number) {
  return Math.round(Number(amount) * 100);
}

function computeShippingEUR(shipCountry: string, totalQty: number) {
  const rule = SHIPPING_RULES[shipCountry] || SHIPPING_RULES.PT;
  const shipping = Math.max(Number(rule.min || 0), totalQty * Number(rule.perItem || 0));
  return shipping;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = getAllowedOrigin(req, env);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true }, { headers: corsHeaders(origin) });
    }

    if (req.method === "POST" && url.pathname === "/create-checkout-session") {
      if (!env.STRIPE_SECRET_KEY) {
        return json(
          { error: "Missing STRIPE_SECRET_KEY in Worker environment." },
          { status: 500, headers: corsHeaders(origin) }
        );
      }

     const stripe = new Stripe(env.STRIPE_SECRET_KEY);

      let body: CreateSessionBody | null = null;
      try {
        body = (await req.json()) as CreateSessionBody;
      } catch {
        return json({ error: "Invalid JSON body." }, { status: 400, headers: corsHeaders(origin) });
      }

      const items = Array.isArray(body?.items) ? body!.items : [];
      const shipCountry = body?.shipCountry || "PT";
      const lang = body?.lang === "pt" ? "pt" : "en";

      if (!items.length) {
        return json({ error: "Cart is empty." }, { status: 400, headers: corsHeaders(origin) });
      }

      // Determine where to redirect after checkout
      // Prefer explicit origin from client (optional), else request origin, else fallback
      const siteOrigin =
        (typeof body?.origin === "string" && body.origin) ||
        req.headers.get("Origin") ||
        "https://hibberds100.github.io";

      const successUrl = `${siteOrigin}/${lang}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${siteOrigin}/${lang}/cart`;

      // Build Stripe line_items using server-trusted pricing
      const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

      for (const it of items) {
        const qty = Math.max(1, Number(it?.qty || 1));
        const slug = String(it?.slug || "").trim();
        const size = String(it?.size || "").trim();

        if (!slug || !size) {
          return json({ error: "Each item must include slug and size." }, { status: 400, headers: corsHeaders(origin) });
        }

        const key = `${slug}__${size}`;
        const unitPrice = PRICE_CATALOG_EUR[key];

        if (!Number.isFinite(unitPrice)) {
          return json(
            { error: `Unknown product/size: ${key}. Add it to PRICE_CATALOG_EUR.` },
            { status: 400, headers: corsHeaders(origin) }
          );
        }

        const title = (it.title && String(it.title).trim()) || slug;

        line_items.push({
          quantity: qty,
          price_data: {
            currency: "eur",
            unit_amount: toCentsEUR(unitPrice),
            product_data: {
              name: `${title} (${size})`,
              // Optional: you can add images later, but Stripe requires publicly accessible URLs.
              // images: it.image ? [it.image] : undefined,
            },
          },
        });
      }

      const totalQty = items.reduce((s, i) => s + Math.max(1, Number(i?.qty || 1)), 0);
      const shippingEUR = computeShippingEUR(shipCountry, totalQty);

      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items,
          // ✅ Dynamic shipping as a single line item (Checkout shipping options)
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: toCentsEUR(shippingEUR), currency: "eur" },
                display_name: "Shipping",
                delivery_estimate: {
                  minimum: { unit: "business_day", value: 7 },
                  maximum: { unit: "business_day", value: 14 },
                },
              },
            },
          ],
          // You can enable address collection later; for now you already chose shipCountry on site
          // shipping_address_collection: { allowed_countries: ["PT","ES","GB","US", ...] },

          success_url: successUrl,
          cancel_url: cancelUrl,

          // Helpful metadata for your records
          metadata: {
            shipCountry,
            lang,
          },
        });

        return json({ url: session.url }, { headers: corsHeaders(origin) });
      } catch (err: any) {
        return json(
          { error: "Stripe error", detail: err?.message || String(err) },
          { status: 500, headers: corsHeaders(origin) }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};