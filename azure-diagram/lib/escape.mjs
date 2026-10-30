// Characters XML 1.0 forbids outright; a label containing one would break every output.
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(FORBIDDEN, '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
