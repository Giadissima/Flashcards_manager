/**
 * Whether an address belongs to nobody in particular.
 *
 * A private or loopback address never identifies a reader: it is the docker
 * network, or a reverse proxy whose forwarded header we are not trusting. The
 * moment such an address is treated as a person, one ban shuts the door on
 * everybody behind it - which, in that case, is everybody.
 */
export function isSharedAddress(ip?: string): boolean {
  if (!ip) return true;

  // ::ffff:10.0.0.1 and friends: an IPv4 address wearing an IPv6 coat
  const plain = ip.replace(/^::ffff:/i, '');

  if (plain === '::1' || plain.startsWith('127.')) return true;
  if (plain.startsWith('10.') || plain.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(plain)) return true;
  // Link-local, and the unique-local range IPv6 uses for the same purpose
  if (plain.startsWith('169.254.') || /^f[cd]/i.test(plain)) return true;

  return false;
}
