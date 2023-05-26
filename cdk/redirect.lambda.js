// https://github.com/keaeriksson/hugo-s3-cloudfront/blob/master/template.yaml

const path = require("path");

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const host = request.headers.host[0].value;
  const domain = host.replace(/^www\./, "");

  // Redirect www to naked
  if (host.includes("www")) {
    console.log("redirecting", host, domain);
    return {
      status: "301",
      statusDescription: "Moved permanently",
      headers: {
        location: [
          {
            key: "Location",
            value: `https://${domain}${request.uri}`,
          },
        ],
      },
    };
  }

  // Redirect trailing slashes
  if (request.uri !== "/" && request.uri.slice(-1) === "/") {
    const uri = `${request.uri.slice(0, -1)}/index.html`;
    console.log("redirecting", request.uri, "->", uri);
    return {
      status: "301",
      statusDescription: "Moved permanently",
      headers: {
        location: [
          {
            key: "Location",
            value: `https://${domain}${uri}`,
          },
        ],
      },
    };
  }

  // Rewrite clean URLs (adding index.html)
  if (!path.extname(request.uri)) {
    const uri = request.uri.replace(/\/?$/, "/index.html");
    console.log("redirecting", request.uri, "->", uri);
    request.uri = uri;
  }

  return request;
};
