// Secure Storage Interceptor
// Redefines Storage prototype methods to automatically encrypt values and hash keys in localStorage.

const SECRET_KEY = "daytoexpense_secure_vault_key_2026";
const ENCRYPT_PREFIX = "SECURE::";

function rc4(key: string, str: string): string {
  const s: number[] = [];
  let j = 0;
  let x;
  let res = '';
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
  }
  let i = 0;
  j = 0;
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

function strToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToStr(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return str;
}

function hashKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  return 'sec_' + (hash >>> 0).toString(16);
}

function encrypt(value: string): string {
  if (value === null || value === undefined) return value;
  const encrypted = rc4(SECRET_KEY, value);
  return ENCRYPT_PREFIX + strToHex(encrypted);
}

function decrypt(value: string): string {
  if (value && value.startsWith(ENCRYPT_PREFIX)) {
    const hex = value.substring(ENCRYPT_PREFIX.length);
    const encrypted = hexToStr(hex);
    return rc4(SECRET_KEY, encrypted);
  }
  return value;
}

if (typeof window !== 'undefined' && window.Storage) {
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.getItem = function (this: Storage, key: string): string | null {
    if (this === window.localStorage) {
      const hashedKey = hashKey(key);
      const rawValue = originalGetItem.call(this, hashedKey);
      if (rawValue === null) return null;
      return decrypt(rawValue);
    }
    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
    if (this === window.localStorage) {
      const hashedKey = hashKey(key);
      const encryptedValue = encrypt(value);
      originalSetItem.call(this, hashedKey, encryptedValue);
      return;
    }
    originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function (this: Storage, key: string): void {
    if (this === window.localStorage) {
      const hashedKey = hashKey(key);
      originalRemoveItem.call(this, hashedKey);
      return;
    }
    originalRemoveItem.call(this, key);
  };
}
export {};
