class SitemapTemplate {
  data() {
    return {
      permalink: "/sitemap.xml",
      eleventyExcludeFromCollections: true
    };
  }

  render(data) {
    const coreRoutes = [
      "/",
      "/disclaimer/",
      "/methodology/",
      "/sources/",
      "/food-left-out-calculator/"
    ];

    const foodRoutes = (data.foods?.items ?? []).map(
      (food) => `/how-long-does-${food.slug}-last/`
    );
    const prefilledRoutes = (data.sitoutPrefills ?? []).map((entry) => entry.url);

    const routes = [...coreRoutes, ...foodRoutes, ...prefilledRoutes];
    const lastmod = data.dataset?.last_updated || "";
    const baseUrl = String(data.site?.url || "").replace(/\/$/, "");

    const urls = routes
      .map(
        (route) =>
          `  <url>\n    <loc>${baseUrl}${route}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }
}

module.exports = SitemapTemplate;
