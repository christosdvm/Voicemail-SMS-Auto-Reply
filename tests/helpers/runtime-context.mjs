import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

export function loadRuntimeContext(initialProperties = {}) {
  const source = fs.readFileSync(new URL('../../Code.gs', import.meta.url), 'utf8');
  const scriptProperties = new Map(
    Object.entries(initialProperties).map(([key, value]) => [key, String(value)])
  );

  const context = {
    console,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return scriptProperties.has(key) ? scriptProperties.get(key) : null;
          },
          setProperty(key, value) {
            scriptProperties.set(key, String(value));
          },
          setProperties(values) {
            Object.entries(values).forEach(([key, value]) => {
              scriptProperties.set(key, String(value));
            });
          },
          deleteProperty(key) {
            scriptProperties.delete(key);
          },
          getProperties() {
            return Object.fromEntries(scriptProperties.entries());
          },
        };
      },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      base64Encode(value) {
        return Buffer.from(value).toString('base64');
      },
      base64EncodeWebSafe(value) {
        return Buffer.from(value).toString('base64url');
      },
      base64DecodeWebSafe(value) {
        return [...Buffer.from(value, 'base64url')];
      },
      computeHmacSha256Signature(value, key) {
        return [...crypto.createHmac('sha256', key).update(value).digest()];
      },
      computeDigest(_algorithm, value) {
        return [...crypto.createHash('sha256').update(String(value)).digest()];
      },
      getUuid() {
        return crypto.randomUUID();
      },
      newBlob(value) {
        return {
          getDataAsString() {
            return Buffer.from(value).toString('utf8');
          },
        };
      },
      formatDate(date, _timeZone, format) {
        if (format === 'H') return String(new Date(date).getUTCHours());
        return new Date(date).toISOString();
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'Code.gs' });
  return { context, scriptProperties };
}
