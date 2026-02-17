function baseUrlFrom(data) {
  return String(data.site?.url || "").replace(/\/$/, "");
}

function organizationNode(data) {
  const baseUrl = baseUrlFrom(data);
  return {
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: data.site?.organizationName || data.site?.name || "Cheffist",
    url: baseUrl,
    subjectOf: [
      {
        "@type": "WebPage",
        url: `${baseUrl}/methodology/`,
        name: "Methodology"
      },
      {
        "@type": "WebPage",
        url: `${baseUrl}/disclaimer/`,
        name: "Disclaimer"
      }
    ]
  };
}

function datasetNode(data) {
  const baseUrl = baseUrlFrom(data);
  return {
    "@type": "Dataset",
    "@id": `${baseUrl}/#dataset`,
    name: "Cheffist Food Safety Dataset",
    description:
      "Conservative educational food storage and sit-out guidance dataset.",
    version: data.dataset?.version,
    dateModified: data.dataset?.last_updated,
    url: `${baseUrl}/sources/`
  };
}

function asJsonLd(graphNodes) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graphNodes
  });
}

module.exports = {
  asJsonLd,
  baseUrlFrom,
  datasetNode,
  organizationNode
};
