export const assertEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`environment variable not found: ${key}`);
  }

  return value;
};

const SUBDOMAIN_NAME = assertEnv("SUBDOMAIN_NAME");
const HOSTED_ZONE_ID = assertEnv("HOSTED_ZONE_ID");
const HOSTED_ZONE_NAME = assertEnv("HOSTED_ZONE_NAME");
const domainName = `${SUBDOMAIN_NAME}.${HOSTED_ZONE_NAME}`;

export const config = {
  subdomainName: SUBDOMAIN_NAME,
  hostedZoneId: HOSTED_ZONE_ID,
  hostedZoneName: HOSTED_ZONE_NAME,
  domainName,
};
